"""LoRA supervised fine-tuning of Qwen3.5-2B for the CyberForge chat routes.

Stages (README.md explains each):
  1. tokenize: each example becomes the exact text the Space feeds llama.cpp
     (serving.prompt_text) followed by the answer and <|im_end|>; only the
     answer tokens carry loss.
  2. LoRA: low-rank adapters on every language-model projection (the 6
     full-attention layers, the 18 Gated-DeltaNet layers and all MLPs). The
     vision tower and embeddings stay frozen.
  3. train with validation loss every `--eval-steps`; the best checkpoint is kept.
  4. merge the adapter into the base weights and save a full model that
     export_gguf.sh converts for llama.cpp.

Run:  python train_lora.py --data data --out runs/cf-qwen35-2b
"""

import argparse
import json
import math
import os
import shutil
import sys
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import (AutoModelForImageTextToText, AutoTokenizer, Trainer, TrainerCallback,
                          TrainingArguments)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serving import prompt_text  # noqa: E402

BASE = "Qwen/Qwen3.5-2B"
# Every linear layer of the language model; nothing in model.visual
TARGETS = (r"model\.language_model\.layers\.\d+\.("
           r"self_attn\.(q_proj|k_proj|v_proj|o_proj)|"
           r"linear_attn\.(in_proj_qkv|in_proj_z|out_proj)|"
           r"mlp\.(gate_proj|up_proj|down_proj))")


def load_rows(path: Path):
    return [json.loads(line) for line in path.open(encoding="utf-8")]


def encode(tok, row, max_len: int):
    system, user, answer = (m["content"] for m in row["messages"])
    prompt = tok(prompt_text(system, user), add_special_tokens=False)["input_ids"]
    target = tok(answer + "<|im_end|>", add_special_tokens=False)["input_ids"]
    if len(prompt) + len(target) > max_len:
        # long prompts lose their middle, as at serving time; the answer is never cut
        keep = max_len - len(target)
        prompt = prompt[: keep // 2] + prompt[-(keep - keep // 2):]
    ids = prompt + target
    return {"input_ids": ids, "labels": [-100] * len(prompt) + target}


class Collate:
    def __init__(self, pad_id: int):
        self.pad_id = pad_id

    def __call__(self, batch):
        n = max(len(b["input_ids"]) for b in batch)
        ids = torch.full((len(batch), n), self.pad_id, dtype=torch.long)
        labels = torch.full((len(batch), n), -100, dtype=torch.long)
        mask = torch.zeros((len(batch), n), dtype=torch.long)
        for i, b in enumerate(batch):
            k = len(b["input_ids"])
            ids[i, :k] = torch.tensor(b["input_ids"])
            labels[i, :k] = torch.tensor(b["labels"])
            mask[i, :k] = 1
        return {"input_ids": ids, "labels": labels, "attention_mask": mask}


class LogFile(TrainerCallback):
    """Every logged metric as one JSON line, for the training report."""

    def __init__(self, path: Path):
        self.path = path

    def on_log(self, args, state, control, logs=None, **kw):
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"step": state.global_step, "epoch": state.epoch, **(logs or {})}) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="runs/cf-qwen35-2b")
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--dropout", type=float, default=0.05)
    ap.add_argument("--batch", type=int, default=8, help="examples per device step")
    ap.add_argument("--accum", type=int, default=2, help="gradient accumulation steps")
    ap.add_argument("--max-len", type=int, default=1024)
    ap.add_argument("--eval-steps", type=int, default=50)
    ap.add_argument("--max-steps", type=int, default=-1, help="stop early (smoke tests)")
    ap.add_argument("--limit", type=int, default=0, help="use only this many training rows (smoke tests)")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cuda = torch.cuda.is_available()
    bf16 = cuda and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if (bf16 or not cuda) else torch.float16

    # ---- 1. tokenize -------------------------------------------------------
    tok = AutoTokenizer.from_pretrained(args.base)
    data = Path(args.data)
    train_rows, val_rows = load_rows(data / "train.jsonl"), load_rows(data / "val.jsonl")
    if args.limit:
        train_rows, val_rows = train_rows[: args.limit], val_rows[: max(8, args.limit // 10)]
    train = [encode(tok, r, args.max_len) for r in train_rows]
    val = [encode(tok, r, args.max_len) for r in val_rows]
    lengths = sorted(len(x["input_ids"]) for x in train)
    answer_tokens = sum(sum(1 for l in x["labels"] if l != -100) for x in train)
    print(f"train {len(train)} rows, val {len(val)}; tokens/row median {lengths[len(lengths) // 2]}, "
          f"max {lengths[-1]}; answer tokens {answer_tokens}", flush=True)

    # ---- 2. model + LoRA ---------------------------------------------------
    model = AutoModelForImageTextToText.from_pretrained(args.base, dtype=dtype)
    model.config.use_cache = False
    lora = LoraConfig(r=args.rank, lora_alpha=args.alpha, lora_dropout=args.dropout, bias="none",
                      target_modules=TARGETS, task_type="CAUSAL_LM")
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    # ---- 3. train ----------------------------------------------------------
    steps_per_epoch = math.ceil(len(train) / (args.batch * args.accum))
    targs = TrainingArguments(
        output_dir=str(out / "checkpoints"),
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=args.accum,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_steps=0.05,  # a float below 1 is a fraction of all steps
        weight_decay=0.0,
        max_grad_norm=1.0,
        bf16=bf16,
        fp16=cuda and not bf16,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_strategy="steps",
        save_steps=args.eval_steps,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        train_sampling_strategy="group_by_length",  # less padding per batch
        remove_unused_columns=False,
        report_to=[],
        seed=42,
        dataloader_num_workers=2 if cuda else 0,
    )
    trainer = Trainer(model=model, args=targs, train_dataset=train, eval_dataset=val,
                      data_collator=Collate(tok.pad_token_id), callbacks=[LogFile(out / "train_log.jsonl")])
    base_eval = trainer.evaluate()
    print(f"validation loss before training: {base_eval['eval_loss']:.4f}", flush=True)
    result = trainer.train()
    final_eval = trainer.evaluate()
    print(f"validation loss after training (best checkpoint): {final_eval['eval_loss']:.4f}", flush=True)

    adapter = out / "adapter"
    trainer.model.save_pretrained(adapter)
    tok.save_pretrained(adapter)
    report = {
        "base": args.base, "settings": vars(args), "train_rows": len(train), "val_rows": len(val),
        "answer_tokens": answer_tokens, "steps_per_epoch": steps_per_epoch,
        "eval_loss_before": base_eval["eval_loss"], "eval_loss_after": final_eval["eval_loss"],
        "best_checkpoint": trainer.state.best_model_checkpoint, "train_runtime_s": result.metrics.get("train_runtime"),
        "train_loss": result.metrics.get("train_loss"), "device": torch.cuda.get_device_name(0) if cuda else "cpu",
    }
    (out / "train_report.json").write_text(json.dumps(report, indent=1))

    # ---- 4. merge ----------------------------------------------------------
    if args.no_merge:
        return
    del trainer, model
    if cuda:
        torch.cuda.empty_cache()
    base = AutoModelForImageTextToText.from_pretrained(args.base, dtype=torch.bfloat16)
    merged = PeftModel.from_pretrained(base, str(adapter)).merge_and_unload()
    merged_dir = out / "merged"
    merged.save_pretrained(merged_dir, safe_serialization=True)
    tok.save_pretrained(merged_dir)
    # the processor and template files the GGUF converter and llama.cpp read
    src = Path(snapshot_download(args.base, allow_patterns=["*.json", "*.jinja", "*.txt"]))
    # (only these kinds: the cache folder also links the base weights, which must
    # not land beside the merged ones)
    for f in src.iterdir():
        if (f.suffix in (".json", ".jinja", ".txt") and not f.name.endswith(".index.json")
                and not (merged_dir / f.name).exists()):
            shutil.copy(f, merged_dir / f.name)
    print(f"merged model saved to {merged_dir}", flush=True)


if __name__ == "__main__":
    main()
