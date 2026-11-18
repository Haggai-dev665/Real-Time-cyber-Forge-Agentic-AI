"""Fixed V2 release gate: raw and served facts, prior-model comparison, regression."""
import argparse
import json
import re
from pathlib import Path
from evaluate import generate, load_model, score, stratified, summarize
from serving import PROMPTS
from security_knowledge import REFERENCES, retrieve, finish_grounded_answer, reference_fallback_needed
from release_cases import QUESTIONS, NEGATIVES, GATE


def factual_pass(answer, ref):
    return all(re.search(p, answer, re.I) for p in ref["required"]) and not any(
        re.search(p, answer, re.I) for p in ref["forbidden"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--previous", required=True)
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--data", default="../data/test.jsonl")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    rows = stratified([json.loads(line) for line in Path(args.data).read_text(encoding="utf-8").splitlines()], 240, 0)
    refs = {r["id"]: r for r in REFERENCES}
    report = {"criteria": GATE, "suite": "fresh V2 scenarios + legacy regression", "models": {}}
    for label, path in (("previous", args.previous), ("candidate", args.candidate)):
        llm = load_model(path, 8)
        facts, regression = [], []
        answers_path = out / f"answers-{label}.jsonl"
        with answers_path.open("w", encoding="utf-8") as stream:
            for topic, questions in QUESTIONS.items():
                ref = refs[topic]
                for i, question in enumerate(questions):
                    for mode in ("analyst", "assistant"):
                        llm.set_seed(i)
                        raw, seconds, tokens = generate(llm, PROMPTS[mode], question, 320)
                        selected = retrieve(question)
                        answer, grounding = finish_grounded_answer(raw, selected, analyst=mode=="analyst")
                        result = {"topic": topic, "mode": mode, "question": question, "raw": raw,
                                  "answer": answer, "seconds": seconds, "grounding": grounding,
                                  "raw_pass": bool(factual_pass(raw, ref)),
                                  "pass": bool(factual_pass(answer, ref)),
                                  "harmful": any(re.search(p, answer, re.I) for p in ref["forbidden"]),
                                  "retrieval_correct": topic in [r["id"] for r in selected]}
                        facts.append(result); stream.write(json.dumps(result)+"\n"); stream.flush()
                print(f"{label}: factual topic {topic} complete", flush=True)
            for i, row in enumerate(rows):
                llm.set_seed(i)
                raw, seconds, tokens = generate(llm, row["messages"][0]["content"], row["messages"][1]["content"], 320)
                answer, _ = finish_grounded_answer(raw, retrieve(row["messages"][1]["content"]), analyst=row["mode"]=="analyst")
                result = {"id": row["id"], "family": row["family"], "answer": answer,
                          "seconds": seconds, "tokens": tokens, "metrics": score(row, answer)}
                regression.append(result); stream.write(json.dumps(result)+"\n"); stream.flush()
                if (i+1)%40 == 0: print(f"{label}: regression {i+1}/240", flush=True)
        llm.close()
        metrics = {"n": len(facts), "fresh_pass": sum(x["pass"] for x in facts)/len(facts),
                   "raw_pass": sum(x["raw_pass"] for x in facts)/len(facts),
                   "reference_fallback": sum(x["grounding"]["mode"]=="verified_reference" for x in facts)/len(facts),
                   "harmful_answers": sum(x["harmful"] for x in facts),
                   "retrieval_correct": sum(x["retrieval_correct"] for x in facts)/len(facts),
                   "retrieval_negative_pass": sum(not retrieve(q) for q in NEGATIVES)/len(NEGATIVES)}
        report["models"][label] = {"facts": metrics, "regression": summarize(regression)}
        (out/"report.partial.json").write_text(json.dumps(report,indent=2))
    facts = report["models"]["candidate"]["facts"]
    old = report["models"]["candidate"]["regression"]
    checks = {"fresh_facts": facts["fresh_pass"] >= GATE["fresh_pass_min"],
              "raw_facts": facts["raw_pass"] >= GATE["raw_pass_min"],
              "fallback_rate": facts["reference_fallback"] <= GATE["reference_fallback_max"],
              "harmful_advice": facts["harmful_answers"] <= GATE["harmful_answers_max"],
              "retrieval": facts["retrieval_correct"] == 1 and facts["retrieval_negative_pass"] >= GATE["retrieval_negative_pass_min"],
              "risk": old.get("risk_exact", 0) >= GATE["risk_exact_min"],
              "concision": old.get("within_80_words", 0) >= GATE["within_80_words_min"],
              "memory": old.get("memory_invented", 1) <= GATE["memory_invented_max"]}
    report.update(checks=checks, passed=all(checks.values()))
    (out/"release_report.json").write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2),flush=True)


if __name__ == "__main__":
    main()
