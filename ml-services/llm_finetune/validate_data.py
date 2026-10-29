"""Validate SFT splits before allocating/loading a GPU model."""
import argparse
import json
from pathlib import Path
from serving import PROMPTS


def validate(data):
    data = Path(data)
    stats = json.loads((data / "stats.json").read_text(encoding="utf-8"))
    seen = set()
    counts = {}
    for split in ("train", "val", "test"):
        count = 0
        for line in (data / f"{split}.jsonl").read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            messages = row["messages"]
            if row["split"] != split or [m["role"] for m in messages] != ["system", "user", "assistant"]:
                raise ValueError(f"Invalid split or roles: {row['id']}")
            if messages[0]["content"] != PROMPTS[row["mode"]] or not all(m["content"].strip() for m in messages):
                raise ValueError(f"Invalid prompt or empty message: {row['id']}")
            key = (row["mode"], messages[1]["content"])
            if key in seen:
                raise ValueError(f"Duplicate prompt across dataset: {row['id']}")
            seen.add(key)
            if row["mode"] == "analyst" and len(messages[2]["content"].split()) > 80:
                raise ValueError(f"Analyst target exceeds 80 words: {row['id']}")
            count += 1
        if not count or count != stats[split]["total"]:
            raise ValueError(f"Empty split or statistics mismatch: {split}")
        counts[split] = count
    return counts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    print(json.dumps(validate(ap.parse_args().data)))
