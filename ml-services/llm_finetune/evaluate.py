"""Compare chat models the way the CyberForge Space runs them.

Each GGUF is loaded with llama-cpp-python and asked every held-out test prompt
with serving.py's prompt text and sampling settings (LocalLLM.chat). Answers
are scored against what the app relies on:

  risk_line        a risk line when the item is a specific indicator, none for a
                   general question (the Space reads risk_level/risk_score from it)
  risk_exact       the stated level equals the level the evidence supports
  over_alarm       stated High/Critical where the evidence supports Low
  under_alarm      stated Low (or nothing) where the evidence supports High/Critical
  within_80_words  analyst answers inside the prompt's 80-word limit
  bullets          analyst answers written as bullet points
  ungrounded_nums  answers quoting a score or percentage that is not in the prompt
  unverified_said  unverifiable items (hash, IP, CVE, domain) called unverified
  memory_recall    flagged hosts from the user's memory that the answer names
  memory_invented  answers naming a host as scanned/flagged that is not in memory
  not_scanned_ok   "is X safe" for a host not in memory, answered without a verdict
  overlap          token F1 with the reference answer (held-out knowledge topics)
  seconds          generation time per answer on this CPU

Run:
  python evaluate.py --data data/test.jsonl --model base=unsloth/Qwen3.5-2B-GGUF:Qwen3.5-2B-Q4_K_M.gguf \
                     --model tuned=out/cyberforge-qwen3.5-2b-Q4_K_M.gguf --limit 240 --out eval
"""

import argparse
import json
import random
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serving import GENERATION, prompt_text, stated_risk, strip_think  # noqa: E402

LEVEL = {"low": 0, "medium": 1, "high": 2, "critical": 3}
HOST = re.compile(r"\b((?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})\b", re.I)


def load_model(spec: str, threads: int):
    from huggingface_hub import hf_hub_download
    from llama_cpp import Llama
    if ":" in spec and not Path(spec).exists():
        repo, filename = spec.split(":", 1)
        spec = hf_hub_download(repo, filename)
    return Llama(model_path=spec, n_ctx=4096, n_threads=threads, n_threads_batch=threads, verbose=False)


def generate(llm, system: str, user: str, max_tokens: int):
    t = time.monotonic()
    out = llm.create_completion(prompt_text(system, user), max_tokens=max_tokens, **GENERATION)
    text = strip_think(out["choices"][0]["text"])
    return text, time.monotonic() - t, out["usage"]["completion_tokens"]


def numbers(text: str):
    """Scores and percentages written in an answer: 0.97, 97%, 92/100."""
    out = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*%", text):
        out.append(float(m.group(1)) / 100)
    for m in re.finditer(r"(?<![\d.])(0\.\d+|1\.00)(?![\d%])", text):
        out.append(float(m.group(1)))
    for m in re.finditer(r"(\d+)\s*/\s*100", text):
        out.append(float(m.group(1)) / 100)
    return out


def prompt_values(text: str):
    vals = set()
    for m in re.finditer(r"\d+(?:\.\d+)?", text):
        v = float(m.group(0))
        vals.update({v, v / 100})
    return vals


def grounded(n: float, vals) -> bool:
    return any(abs(n - v) <= 0.006 for v in vals)


def tokens(s: str):
    return re.findall(r"[a-z0-9]+", s.lower())


def f1(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    common = sum(min(ta.count(w), tb.count(w)) for w in set(ta))
    if not common:
        return 0.0
    p, r = common / len(ta), common / len(tb)
    return 2 * p * r / (p + r)


def score(row, answer: str):
    """Per-item measurements; None where a measure does not apply."""
    system, user, ref = (m["content"] for m in row["messages"])
    fam, meta = row["family"], row.get("meta") or {}
    m = {}
    said = stated_risk(answer)
    want = meta.get("risk")
    if row["mode"] == "analyst":
        m["risk_line"] = (said is not None) == (want is not None)
        if want is not None:
            w = LEVEL[want.lower()]
            m["risk_exact"] = said is not None and LEVEL[said] == w
            if w == 0:
                m["over_alarm"] = said is not None and LEVEL[said] >= 2
            if w >= 2:
                m["under_alarm"] = said is None or LEVEL[said] == 0
        m["within_80_words"] = len(answer.split()) <= 80
        m["bullets"] = bool(re.search(r"^\s*([-*•]|\d+\.)\s", answer, re.M))
    else:
        m["risk_line"] = said is None
    nums = numbers(answer)
    if nums:
        vals = prompt_values(user)
        m["ungrounded_nums"] = not all(grounded(n, vals) for n in nums)
    else:
        m["ungrounded_nums"] = False
    if fam.startswith("unverified_"):
        m["unverified_said"] = bool(re.search(r"unverif|not (been )?(verified|checked)|cannot (be )?(verif|confirm)|no (reputation|record|advisory|evidence)", answer, re.I))
    if fam.startswith("memory_"):
        in_memory = set(h.lower() for h in meta.get("hosts", []))
        named = set(h.lower().rstrip(".") for h in HOST.findall(answer))
        if fam == "memory_list_bad" and meta.get("bad"):
            m["memory_recall"] = sum(h.lower() in named for h in meta["bad"]) / len(meta["bad"])
        mentioned_in_prompt = set(h.lower().rstrip(".") for h in HOST.findall(user))
        m["memory_invented"] = bool(named - in_memory - mentioned_in_prompt)
        if fam == "memory_not_scanned":
            m["not_scanned_ok"] = not re.search(r"\b(flagged as|is (safe|clean|malicious|phishing)|was (clean|flagged))\b", answer, re.I)
    if fam in ("general", "small_talk"):
        m["overlap"] = f1(answer, ref)
    return m


def stratified(rows, limit: int, seed: int):
    if not limit or limit >= len(rows):
        return rows
    by = defaultdict(list)
    for r in rows:
        by[r["family"].split("_")[0] if not r["family"].startswith(("memory_", "unverified_")) else r["family"]].append(r)
    rng = random.Random(seed)
    for v in by.values():
        rng.shuffle(v)
    out, i = [], 0
    while len(out) < limit:
        added = False
        for k in sorted(by):
            if i < len(by[k]) and len(out) < limit:
                out.append(by[k][i])
                added = True
        if not added:
            break
        i += 1
    return out


def summarize(results):
    agg = defaultdict(list)
    for r in results:
        for k, v in r["metrics"].items():
            if v is not None:
                agg[k].append(float(v))
        agg["seconds"].append(r["seconds"])
        agg["answer_tokens"].append(r["tokens"])
    return {k: round(sum(v) / len(v), 4) for k, v in agg.items() if v} | {"n": len(results)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/test.jsonl")
    ap.add_argument("--model", action="append", required=True, help="name=path.gguf or name=repo:file.gguf")
    ap.add_argument("--limit", type=int, default=240)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--max-tokens", type=int, default=320, help="the Space's LOCAL_LLM_MAX_TOKENS")
    ap.add_argument("--out", default="eval")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    rows = stratified([json.loads(l) for l in open(args.data, encoding="utf-8")], args.limit, args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {"data": args.data, "items": len(rows), "models": {}}
    for spec in args.model:
        name, path = spec.split("=", 1)
        llm = load_model(path, args.threads)
        results = []
        for i, row in enumerate(rows):
            system, user = row["messages"][0]["content"], row["messages"][1]["content"]
            answer, seconds, n = generate(llm, system, user, args.max_tokens)
            results.append({"id": row["id"], "family": row["family"], "answer": answer, "seconds": round(seconds, 2),
                            "tokens": n, "metrics": score(row, answer)})
            if (i + 1) % 20 == 0:
                print(f"[{name}] {i + 1}/{len(rows)}", flush=True)
        with (out / f"answers_{name}.jsonl").open("w", encoding="utf-8") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        families = defaultdict(list)
        for r in results:
            families[r["family"].split("_")[0]].append(r)
        report["models"][name] = {"path": path, "overall": summarize(results),
                                  "by_family": {k: summarize(v) for k, v in sorted(families.items())}}
        del llm
    (out / "report.json").write_text(json.dumps(report, indent=1))

    names = list(report["models"])
    keys = sorted({k for n in names for k in report["models"][n]["overall"] if k != "n"})
    lines = ["| metric | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
    for k in keys:
        lines.append(f"| {k} | " + " | ".join(str(report["models"][n]["overall"].get(k, "")) for n in names) + " |")
    (out / "report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
