"""Build V2 from corrected replay plus reviewed-reference instruction examples.

The old test set is preserved for regression, not reclassified as new data.
Fresh release questions live in release_cases.py and never enter training.
"""
import copy
import hashlib
import json
import random
from collections import Counter
from pathlib import Path
from serving import messages
from security_knowledge import REFERENCES
from validate_data import validate

TEMPLATES = [
    "Explain {term} in plain language.", "Give me a short overview of {term}.",
    "What should a defender know about {term}?", "Summarize the main facts about {term}.",
    "Describe the security implications of {term}.", "Help me understand {term} without jargon.",
    "Give concise guidance on {term}.", "Explain the mechanism and defence for {term}.",
    "What is important when discussing {term}?", "Can you explain {term} to a colleague?",
    "I need a factual summary of {term}.", "What should I remember about {term}?",
]
TERMS = {"csrf": "CSRF", "mfa-fatigue": "MFA fatigue", "heartbleed": "Heartbleed",
         "zero-trust": "zero trust", "sql-injection": "SQL injection", "xss": "XSS",
         "ssrf": "SSRF", "quishing": "quishing", "cryptojacking": "cryptojacking",
         "passwords": "password rotation", "sessions": "session cookies", "rootkit": "rootkits",
         "sandbox": "sandbox analysis"}


def build(source, out):
    source, out = Path(source), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(237)
    splits = {}
    for split in ("train", "val", "test"):
        rows = [json.loads(line) for line in (source / f"{split}.jsonl").read_text(encoding="utf-8").splitlines()]
        # Replay is task-balanced and includes the complete validation/test splits.
        if split == "train":
            by = {}
            for r in rows:
                by.setdefault(r["family"], []).append(r)
            rows = []
            for family in sorted(by):
                rng.shuffle(by[family])
                rows += by[family][:100]
        for index, row in enumerate(rows):
            row = copy.deepcopy(row)
            answer = row["messages"][2]["content"]
            answer = answer.replace("All detectors stay below", "The supervised detectors stay below")
            answer = answer.replace("No detector flags it; the highest", "No supervised detector flags it; their highest")
            row["messages"][2]["content"] = answer
            rows[index] = row
        splits[split] = rows
    for ref in REFERENCES:
        if ref["id"] in {"ssrf", "sessions"}:
            continue  # Held out from reference instruction tuning; retrieved at evaluation.
        for i, template in enumerate(TEMPLATES):
            for mode in ("analyst", "assistant"):
                question = template.format(term=TERMS[ref["id"]])
                # Distinct surface forms; retrieval facts come from the shared library.
                if mode == "assistant":
                    question = "Please help: " + question
                answer = "- " + ref["facts"] if mode == "analyst" else ref["facts"]
                split = "val" if i == len(TEMPLATES) - 1 else "train"
                splits[split].append({"id": f"v2-ref-{ref['id']}-{mode}-{i}", "mode": mode,
                    "family": "reference_grounding", "split": split,
                    "messages": messages(mode, question, answer),
                    "meta": {"source": ref["url"], "reference_id": ref["id"], "risk": None}})
    stats = {}
    for split, rows in splits.items():
        rng.shuffle(rows)
        (out / f"{split}.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False)+"\n" for row in rows), encoding="utf-8")
        stats[split] = {"total": len(rows), "families": dict(Counter(row["family"] for row in rows))}
    stats["provenance"] = {"kind": "V2 corrected replay and reviewed-reference instruction tuning",
                           "source_train_sha256": hashlib.sha256((source / "train.jsonl").read_bytes()).hexdigest(),
                           "old_test_status": "regression set; known weaknesses were reviewed",
                           "fresh_test": "release_cases.py scenarios, excluded from training"}
    (out / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    validate(out)
    print(json.dumps({split: len(rows) for split, rows in splits.items()}))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    build(args.source, args.out)
