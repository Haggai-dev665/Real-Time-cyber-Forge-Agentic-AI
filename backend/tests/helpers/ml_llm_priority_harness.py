"""Exercise the ML Space's LocalLLM scheduling (ml-services/hf_space_deploy/app.py)
with a fake model that streams slowly: no model is loaded and app.py is not
imported, only the class and its settings are taken from the source. Prints one
JSON object of results.

    python ml_llm_priority_harness.py <app.py>
"""
import ast
import json
import re
import sys
import threading
import time
from typing import Dict, List, Optional

SETTINGS = {"LOCAL_LLM_REPO", "LOCAL_LLM_FILE", "LOCAL_LLM_MAX_TOKENS", "LOCAL_LLM_TEMPERATURE",
            "LOCAL_LLM_MAX_INPUT_CHARS", "LOCAL_LLM_TIME_BUDGET_S", "LOCAL_LLM_MAX_TIME_BUDGET_S",
            "LOCAL_LLM_QUEUE_TIMEOUT_S", "LOCAL_LLM_INTERACTIVE_WAIT_S"}


class FakeModel:
    """Streams one word every 50 ms, up to `words` words."""
    def __init__(self, words=200):
        self.words = words

    def create_chat_completion(self, messages, max_tokens, temperature, top_p, stream):
        def chunks():
            for i in range(self.words):
                time.sleep(0.05)
                yield {"choices": [{"delta": {"content": f"word{i}. "}, "finish_reason": None}]}
        return chunks()


def load(source_path):
    tree = ast.parse(open(source_path, encoding="utf-8").read())
    picked = [n for n in tree.body if (isinstance(n, ast.ClassDef) and n.name == "LocalLLM")
              or (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in SETTINGS for t in n.targets))]
    namespace = {"os": __import__("os"), "re": re, "time": time, "threading": threading, "Dict": Dict, "List": List,
                 "Optional": Optional, "logger": None, "hf_hub_download": None, "subprocess": None, "sys": sys}
    exec(compile(ast.Module(body=picked, type_ignores=[]), source_path, "exec"), namespace)
    return namespace


def main():
    ns = load(sys.argv[1])
    llm = ns["LocalLLM"]()
    llm.llm = FakeModel()
    results = {}

    # 1. A background generation is running; a question arrives and gets the model.
    background = {}
    t = threading.Thread(target=lambda: background.update(llm.chat("sys", "explain this scan", time_budget_s=8)))
    t.start()
    time.sleep(0.5)
    asked = time.monotonic()
    answer = llm.chat("sys", "hi", max_tokens=40, time_budget_s=20, interactive=True)
    got_model_after = None if answer.get("error") else round(time.monotonic() - asked - answer["elapsed_ms"] / 1000, 2)
    t.join()
    results["question_during_background"] = {
        "answered": answer.get("response") is not None,
        "waited_s": got_model_after,
        "background_truncated": background.get("truncated"),
        "background_tokens": background.get("tokens"),
    }

    # 2. While a question waits, new background work does not start.
    llm._gen_lock.acquire()
    waiter = threading.Thread(target=lambda: results.update(waiting_question=llm.chat("sys", "q", time_budget_s=15, interactive=True).get("error")))
    waiter.start()
    time.sleep(0.3)
    blocked = llm.chat("sys", "background while a question waits", time_budget_s=5)
    llm._gen_lock.release()
    waiter.join()
    results["background_while_question_waits"] = blocked.get("error")

    # 3. A question that cannot get the model in its wait is told so.
    llm._gen_lock.acquire()
    started = time.monotonic()
    refused = llm.chat("sys", "q", time_budget_s=15, interactive=True)
    results["question_refused_after_s"] = round(time.monotonic() - started, 1)
    results["question_refused_error"] = refused.get("error")
    llm._gen_lock.release()

    # 4. Background work alone still runs, within its budget.
    alone = llm.chat("sys", "explain", time_budget_s=5)
    results["background_alone"] = {"answered": alone.get("response") is not None, "truncated": alone.get("truncated")}
    print(json.dumps(results))


main()
