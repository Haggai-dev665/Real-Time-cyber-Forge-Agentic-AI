"""Recheck source-constrained answers, preserving the original report unchanged.

Unchanged legacy prompts reuse measured outputs only when the model revision,
seed and entire serialized input match the original run. Changed inputs run again.
"""
import argparse
import hashlib
import importlib.util
import json
import re
from pathlib import Path
from huggingface_hub import hf_hub_download
from evaluate import generate, load_model, score, stratified, summarize
from release_cases import QUESTIONS, NEGATIVES, GATE
from postreview_cases import QUESTIONS as NEW_QUESTIONS
from release_evaluate import factual_pass
from serving import PROMPTS, clean_user_text, prompt_text, THINK_PREFILL
from security_knowledge import retrieve, finish_grounded_answer, reference_fallback_needed, REFERENCES, REVISION

MODEL_REVISION = "494483e9a85362b5d0bd596f9040bbc0848c860a"
ORIGINAL_BUNDLE = "df12b153a9e0e37e527cc9db6e952698d977b6e9"


def old_prompt(module, system, user):
    system, user = clean_user_text(system, user)
    system, _ = module.ground_prompt(system, user)
    return (f"<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n"
            f"<|im_start|>assistant\n{THINK_PREFILL}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--previous", required=True); ap.add_argument("--candidate", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    old_file = hf_hub_download("Che237/cyberforge-llm-sft-v2", "hf_space_deploy/security_knowledge.py",
                              repo_type="dataset", revision=ORIGINAL_BUNDLE)
    spec = importlib.util.spec_from_file_location("original_knowledge", old_file)
    old = importlib.util.module_from_spec(spec); spec.loader.exec_module(old)
    refs = {r["id"]: r for r in REFERENCES}
    rows = stratified([json.loads(l) for l in Path("../data/test.jsonl").read_text().splitlines()], 240, 0)
    report = {"criteria": GATE, "knowledge_revision": REVISION, "models": {},
              "latency_mixes_reused_and_regenerated_measurements": True,
              "original_bundle": ORIGINAL_BUNDLE, "candidate_revision": MODEL_REVISION,
              "method": "original scenarios plus 26 additional reviewed scenarios; exact-input regression reuse",
              "generation_constraint": "reviewed_passages",
              "interpretation": "Covered answers use extractive constrained decoding; raw_pass does not measure unaided recall."}
    for label, path in (("previous", args.previous), ("candidate", args.candidate)):
        original_answers = hf_hub_download("Che237/cyberforge-qwen3.5-2b-v2-GGUF",
            f"release/{MODEL_REVISION}/answers-{label}.jsonl")
        cached = {r["id"]: r for r in map(json.loads, Path(original_answers).read_text().splitlines()) if "id" in r}
        llm = load_model(path, 8); facts = []; legacy = []; reused = 0
        with (out/f"answers-{label}.jsonl").open("w",encoding="utf-8") as stream:
            for suite, questions in (("reviewed_regression", QUESTIONS), ("additional", NEW_QUESTIONS)):
                for topic, prompts in questions.items():
                    for i, question in enumerate(prompts):
                        for mode in ("analyst", "assistant"):
                            llm.set_seed(i)
                            raw, seconds, tokens = generate(llm, PROMPTS[mode], question, 320)
                            selected = retrieve(question)
                            answer, info = finish_grounded_answer(raw, selected, analyst=mode=="analyst")
                            if selected:
                                info["generation_constraint"] = "reviewed_passages"
                            item = {"suite": suite, "topic": topic, "mode": mode, "question": question,
                                    "raw": raw, "answer": answer, "grounding": info,
                                    "raw_pass": bool(factual_pass(raw,refs[topic])),
                                    "pass": bool(factual_pass(answer,refs[topic])),
                                    "faithful": not reference_fallback_needed(raw,selected),
                                    "retrieval_correct": topic in [r["id"] for r in selected]}
                            facts.append(item); stream.write(json.dumps(item)+"\n"); stream.flush()
                    print(f"{label}: {suite} {topic}",flush=True)
            for i,row in enumerate(rows):
                system,user = [m["content"] for m in row["messages"][:2]]
                serialized = prompt_text(system,user)
                unchanged = serialized == old_prompt(old,system,user) and not retrieve(user)
                if unchanged:
                    item = dict(cached[row["id"]]); reused += 1
                    item.update(reused=True,input_sha256=hashlib.sha256(serialized.encode()).hexdigest())
                else:
                    llm.set_seed(i); raw,seconds,tokens=generate(llm,system,user,320)
                    answer,_=finish_grounded_answer(raw,retrieve(user),analyst=row["mode"]=="analyst")
                    item={"id":row["id"],"family":row["family"],"answer":answer,"seconds":seconds,"tokens":tokens,"metrics":score(row,answer),"reused":False}
                legacy.append(item);stream.write(json.dumps(item)+"\n");stream.flush()
            llm.close()
        def stats(items):
            n=len(items)
            return {"n":n,"fresh_pass":sum(r["pass"] for r in items)/n,
                    "raw_pass":sum(r["raw_pass"] for r in items)/n,
                    "reference_fallback":sum(r["grounding"]["mode"]=="verified_reference" for r in items)/n,
                    "retrieval_correct":sum(r["retrieval_correct"] for r in items)/n,
                    "harmful_answers":sum(any(re.search(p,r["answer"],re.I) for p in refs[r["topic"]]["forbidden"]) for r in items)}
        report["models"][label]={"all_facts":stats(facts),"additional_facts":stats([r for r in facts if r["suite"]=="additional"]),
                                "regression":summarize(legacy),"regression_reused":reused,"regression_regenerated":240-reused}
        (out/"report.partial.json").write_text(json.dumps(report,indent=2))
    candidate=report["models"]["candidate"]; a=candidate["all_facts"]; b=candidate["additional_facts"]; r=candidate["regression"]
    checks={"fresh_facts":min(a["fresh_pass"],b["fresh_pass"])>=GATE["fresh_pass_min"],
            "raw_facts":min(a["raw_pass"],b["raw_pass"])>=GATE["raw_pass_min"],
            "fallback_rate":max(a["reference_fallback"],b["reference_fallback"])<=GATE["reference_fallback_max"],
            "harmful_advice":a["harmful_answers"]<=GATE["harmful_answers_max"],
            "retrieval":a["retrieval_correct"]==1 and all(not retrieve(q) for q in NEGATIVES),
            "risk":r.get("risk_exact",0)>=GATE["risk_exact_min"],
            "concision":r.get("within_80_words",0)>=GATE["within_80_words_min"],
            "memory":r.get("memory_invented",1)<=GATE["memory_invented_max"]}
    report.update(checks=checks,passed=all(checks.values()))
    (out/"release_report.json").write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2),flush=True)


if __name__ == "__main__": main()
