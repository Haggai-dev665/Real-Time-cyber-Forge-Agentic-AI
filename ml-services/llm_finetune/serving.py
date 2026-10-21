"""What the CyberForge Space sends to its chat model, copied from
hf_space_deploy/app.py so training, evaluation and serving use one format.

If the prompts or generation settings in app.py change, change them here too:
a model fine-tuned on one prompt and served with another loses much of what it
learned. tests in this folder check that the two copies agree.
"""

import re
from typing import Dict, List, Optional

# TransformerModelLoader.SYSTEM_PROMPT: background analysis (scans, alerts, reports)
SYSTEM_PROMPT = (
    "You are CyberForge AI, a cybersecurity analyst. Answer in at most 80 words, "
    "as short bullet points. If the user gives a specific URL, file, alert or "
    "incident to assess, begin with one line 'Risk Level: X', where X is Critical, "
    "High, Medium or Low, chosen from the evidence given. For general questions, "
    "do not include a risk level. Use only the information provided and "
    "well-established security knowledge. If something has not been checked, "
    "such as reputation, hashes or CVEs, say it is unverified instead of guessing."
)

# TransformerModelLoader.ASSISTANT_PROMPT: a person chatting (priority "interactive")
ASSISTANT_PROMPT = (
    "You are the CyberForge assistant, a friendly, helpful chat assistant built into "
    "the CyberForge security app. Talk naturally, like a normal chat assistant: reply "
    "to greetings and small talk briefly and warmly, and offer to help. Answer security "
    "questions clearly and concisely, in plain sentences, using a short list only for "
    "steps. When the message includes the user's CyberForge memory, use it only if it "
    "helps answer. Never claim to have scanned, detected or checked anything that is "
    "not in the message; if something has not been checked, say so."
)

PROMPTS = {"analyst": SYSTEM_PROMPT, "assistant": ASSISTANT_PROMPT}

# LocalLLM.chat: Qwen3.5 answers directly when the assistant turn opens with an
# empty think block (what its template emits for enable_thinking=False).
THINK_PREFILL = "<think>\n\n</think>\n\n"
MAX_INPUT_CHARS = 2400
GENERATION = dict(temperature=0.3, top_p=0.8, top_k=20, presence_penalty=1.5,
                  stop=["<|im_end|>", "<|endoftext|>"])

# app.py RISK_LINE: how the Space reads a risk level out of an answer
RISK_LINE = re.compile(r"risk(?:\s+level)?\W{0,6}(critical|high|medium|low)\b", re.IGNORECASE)


def stated_risk(text: str) -> Optional[str]:
    m = RISK_LINE.search(text or "")
    return m.group(1).lower() if m else None


def clean_user_text(system: str, user: str) -> (str, str):
    """LocalLLM.chat's input handling: chat markers removed, long input cut in
    the middle (context at the start, the question at the end)."""
    system = system.replace("<|im_start|>", "").replace("<|im_end|>", "")
    user = user.replace("<|im_start|>", "").replace("<|im_end|>", "")
    if len(user) > MAX_INPUT_CHARS:
        half = MAX_INPUT_CHARS // 2
        user = f"{user[:half]}\n[...]\n{user[-half:]}"
    return system, user


def prompt_text(system: str, user: str) -> str:
    """The exact text LocalLLM.chat feeds llama.cpp, up to where the answer starts."""
    system, user = clean_user_text(system, user)
    return (
        f"<|im_start|>system\n{system}<|im_end|>\n"
        f"<|im_start|>user\n{user}<|im_end|>\n"
        f"<|im_start|>assistant\n{THINK_PREFILL}"
    )


def strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def messages(mode: str, user: str, answer: Optional[str] = None) -> List[Dict]:
    out = [{"role": "system", "content": PROMPTS[mode]}, {"role": "user", "content": user}]
    if answer is not None:
        out.append({"role": "assistant", "content": answer})
    return out
