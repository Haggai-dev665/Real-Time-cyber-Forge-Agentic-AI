"""Run the ML Space's analysis_record (ml-services/hf_space_deploy/app.py) on
stand-in predictions, without importing app.py (which would load the models).
Only the function and its constants are taken from the source. Prints one
JSON object of results.

    python ml_analysis_harness.py <app.py>
"""
import ast
import json
import sys
import time
import uuid
from typing import Dict

NAMES = {"analysis_record", "ANALYSIS_SCHEMA", "VERDICT_POLICY", "SERVICE_VERSION"}


class StubLoader:
    metadata = {
        "phishing_detection": {"trained_at": "2026-10-13T00:00:00Z", "decision_threshold": 0.71, "feature_set": "lexical_v2"},
        "malware_detection": {"trained_at": "2026-10-13T00:00:00Z", "decision_threshold": 0.66},
    }


def load(source_path):
    tree = ast.parse(open(source_path, encoding="utf-8").read())
    picked = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in NAMES:
            picked.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in NAMES for t in node.targets):
            picked.append(node)
    namespace = {"Dict": Dict, "uuid": uuid, "time": time, "ml_loader": StubLoader(), "popular_domains_loaded": lambda: 300000}  # like the real one: a count
    exec(compile(ast.Module(body=picked, type_ignores=[]), source_path, "exec"), namespace)
    return namespace["analysis_record"]


def main():
    record = load(sys.argv[1])
    trained = lambda name, prediction, score: {"model": name, "prediction": prediction, "threat_score": score, "inference_source": "ml_model"}
    heuristic = lambda name, prediction, score, **extra: {"model": name, "prediction": prediction, "threat_score": score, "inference_source": "heuristic", **extra}
    cases = {
        "all_trained_benign": {"phishing_detection": trained("phishing_detection", 0, 0.1), "malware_detection": trained("malware_detection", 0, 0.2)},
        "one_trained_flags": {"phishing_detection": trained("phishing_detection", 1, 0.9), "malware_detection": trained("malware_detection", 0, 0.2)},
        "heuristic_only": {"phishing_detection": heuristic("phishing_detection", 1, 0.8, missing_features=["x"]), "malware_detection": heuristic("malware_detection", 0, 0.3, note="the domain popularity list is not loaded, so the model was not used")},
        "heuristic_flag_trained_benign": {"phishing_detection": trained("phishing_detection", 0, 0.1), "web_attack_detection": heuristic("web_attack_detection", 1, 0.9)},
        "an_error": {"phishing_detection": {"error": "Model 'phishing_detection' not loaded"}},
    }
    out = {}
    for name, predictions in cases.items():
        out[name] = record("https://example.com/", predictions, time.perf_counter())
    print(json.dumps(out))


main()
