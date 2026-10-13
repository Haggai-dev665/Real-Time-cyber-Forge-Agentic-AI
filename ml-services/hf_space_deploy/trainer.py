"""
Trains the CyberForge detection models from public, labelled data.

(Second version. The first took its benign and phishing URLs from one older
collection whose benign URLs are deep links from a crawl and whose phishing
URLs are mostly short. A dry run showed the phishing model had learned exactly
that, path length, and it scored bbc.co.uk/news at 0.96; the acceptance gate
rejected it. The benign and phishing examples now come from several sources
that overlap in shape, including the landing pages of popular sites.)

This runs inside the Hugging Face Space (app.py starts it from a protected
endpoint). It is never run on a developer machine.

What it replaces: the first models were fitted to made-up numbers in which
"benign" URLs were 15-60 characters long and "malicious" ones 60-300, so the
phishing, malware and web-attack models were three copies of "a long URL is a
threat". Here each model learns from real examples of the thing it is named
after:

  phishing_detection    benign URLs  vs  reported phishing URLs
  malware_detection     benign URLs  vs  URLs that served malware
  web_attack_detection  ordinary URLs vs URLs carrying real SQL-injection and
                        cross-site-scripting payloads
  anomaly_detection     an IsolationForest fitted to benign URLs only

A model is uploaded and put into service only if it passes an acceptance gate
on sites it never saw during training. The gate is fixed below, before any
result is known, and every number it used is written to the model's
metadata.json.
"""

import json
import logging
import random
import tempfile
import time
import traceback
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional
from urllib.parse import quote

import joblib
import numpy as np
import pandas as pd
from huggingface_hub import HfApi, hf_hub_download
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

from url_features import (ALL_FEATURES, ATTACK_FEATURES, LEXICAL_FEATURES, bare_url, build_popularity,
                          extract_url_features, registered_domain, rescale_score, split_url)

logger = logging.getLogger("cyberforge.trainer")

PHISHING_COLLECTION = "Mitake/PhishingURLsANDBenignURLs"     # ~886k URLs: benign (0) / phishing (1), CC-BY-SA-4.0
URL_COLLECTION = "bgspaditya/byt-malicious-url-treatment"   # ~640k URLs; used for its malware URLs and some benign ones
PHISHING_REFERENCE = "pirocheto/phishing-url"                 # 11k balanced full URLs, CC-BY-4.0, with its own test split
POPULAR_SITES = "phl-ldm/tranco_top_million"                  # landing pages of top-million sites, CC-BY-4.0 (one small file of it)
ATTACK_PAYLOADS = "shengqin/web-attacks"                      # SQL-injection and XSS payloads, and normal strings
# The Tranco list of most-visited sites, by its permanent ID (the list the
# popular-sites crawl above was made from), for the domain-popularity feature.
TRANCO_LIST = "https://tranco-list.eu/download/PYGVJ/1000000"

DEFAULTS = {
    "benign_sample": 120000,            # benign URLs from the phishing collection
    "collection_benign_sample": 40000,  # benign URLs from the older collection (deep links)
    "popular_sample": 60000,            # landing pages of popular sites
    "phishing_sample": 120000,
    "malware_sample": 30000,
    "attack_benign_sample": 40000,
    "test_fraction": 0.2,
    "max_iter": 300,
    "learning_rate": 0.1,
    "max_leaf_nodes": 31,
    "min_samples_leaf": 20,
    "l2_regularization": 0.0,
    "anomaly_contamination": 0.02,
    "popular_domains": 300000,          # how much of the most-visited list the popularity feature knows
    "target_false_positive_rate": 0.02, # each classifier's decision point, measured on validation sites
    "seed": 42,
}

# The acceptance gate. A classifier is put into service only if, on held-out
# sites, it separates the classes (AUC), rarely flags a benign URL, and flags
# none of the well-known legitimate URLs below.
GATE = {"min_auc": 0.90, "max_false_positive_rate": 0.05, "max_known_legitimate_flagged": 0}
# The anomaly model has no labels to be scored against, so its gate is that it
# flags few held-out benign URLs and clearly more malicious ones. (The first
# version only asked for "more"; a model that flagged 1.8% of malicious URLs
# against 1.6% of benign ones passed, which is no separation at all.)
ANOMALY_GATE = {"max_benign_flagged": 0.05, "min_malicious_flagged": 0.10, "min_ratio": 3.0}

# Well-known legitimate URLs, several of them long or full of parameters: the
# kind the first models called critical. They are never used for training.
KNOWN_LEGITIMATE = [
    "https://www.google.com/search?q=cybersecurity",
    "https://accounts.google.com/signin/v2/identifier?continue=https%3A%2F%2Fmail.google.com&service=mail&flowName=GlifWebSignIn",
    "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array",
    "https://www.amazon.com/dp/B08N5WRWNW?ref=abc&th=1",
    "https://github.com/",
    "https://github.com/login",
    "https://github.com/torvalds/linux/blob/master/README",
    "https://en.wikipedia.org/wiki/Phishing",
    "https://docs.python.org/3/library/json.html",
    "https://mail.google.com/mail/u/0/",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.bbc.co.uk/news",
    "https://www.nytimes.com/2024/05/01/technology/ai-safety.html",
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=4765445b-32c6-49b0-83e6-1d93765276ca&response_type=code&scope=openid",
    "https://www.paypal.com/signin",
    "https://www.linkedin.com/in/someone-123456/",
    "https://www.reddit.com/r/netsec/comments/abc123/some_title/",
    "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv/view?usp=sharing",
    "https://www.apple.com/shop/buy-iphone",
    "https://huggingface.co/spaces/Che237/cyberforge",
    "https://www.booking.com/searchresults.html?ss=Paris&checkin=2025-06-01&checkout=2025-06-05&group_adults=2",
    "https://zoom.us/j/1234567890?pwd=QWxhZGRpbjpvcGVuIHNlc2FtZQ",
    "https://www.wikipedia.org/",
    "http://example.com/",
]
# Obviously hostile shapes, reported for information only.
KNOWN_HOSTILE = {
    "phishing_detection": [
        "http://paypal-secure-login.verify-account.xyz/update/password.php",
        "http://192.168.10.5/secure-login/paypal.com/verify?account=1&session=abc@evil",
        "http://appleid.apple.com.signin-verify.account-update.info/webscr/login.php?cmd=_login",
    ],
    "malware_detection": [
        "http://185.220.101.4:8080/bins/mips.sh",
        "http://103.45.12.9/update/setup.exe",
        "http://45.9.148.3:1337/x86_64",
    ],
    # Phishing hosted on a popular platform: the platform's reputation must not cover it.
    "phishing on a popular platform": [
        "https://sites.google.com/view/paypal-account-verify-login/home",
        "https://paypal-login-secure.github.io/verify/index.html",
        "https://storage.googleapis.com/secure-update-0091/login.html",
    ],
    "web_attack_detection": [
        "https://shop.example.com/item.php?id=1%27%20UNION%20SELECT%20username,password%20FROM%20users--",
        "https://example.com/search?q=<script>alert(document.cookie)</script>",
        "https://example.com/download?file=../../../../etc/passwd",
    ],
}

PARAMETERS = ["id", "q", "search", "query", "page", "item", "cat", "user", "name", "redirect", "file", "ref", "s", "keyword", "lang"]


class TrainingError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

def _download(repo: str, wanted: Callable[[str], bool], token: Optional[str]) -> List[str]:
    """Download the dataset files whose path `wanted` accepts; return local paths."""
    api = HfApi(token=token)
    files = [name for name in api.list_repo_files(repo, repo_type="dataset") if wanted(name)]
    if not files:
        raise TrainingError(f"No matching data files in {repo}")
    return [hf_hub_download(repo_id=repo, filename=name, repo_type="dataset", token=token) for name in sorted(files)]


def _revision(repo: str, token: Optional[str]) -> Optional[str]:
    try:
        return HfApi(token=token).dataset_info(repo).sha
    except Exception:
        return None


def clean_urls(values) -> List[str]:
    """Usable URL strings: one line each, of a sensible length, no duplicates."""
    seen, out = set(), []
    for value in values:
        if not isinstance(value, str):
            continue
        url = value.strip()
        if not url or len(url) > 2000 or "\n" in url or "\r" in url or " " in url[:8]:
            continue
        key = bare_url(url).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(url)
    return out


def load_phishing_collection(token: Optional[str]) -> Dict[str, List[str]]:
    path = _download(PHISHING_COLLECTION, lambda name: name.endswith(".csv"), token)[0]
    frame = pd.read_csv(path, usecols=["url", "label"])
    return {"benign": clean_urls(frame.loc[frame["label"] == 0, "url"].tolist()),
            "phishing": clean_urls(frame.loc[frame["label"] == 1, "url"].tolist())}


def load_url_collection(token: Optional[str]) -> Dict[str, List[str]]:
    paths = _download(URL_COLLECTION, lambda name: name.startswith("data/train") and name.endswith(".parquet"), token)
    frame = pd.concat([pd.read_parquet(path, columns=["url", "type"]) for path in paths], ignore_index=True)
    return {kind: clean_urls(frame.loc[frame["type"] == kind, "url"].tolist()) for kind in ("benign", "malware")}


def load_popular_sites(token: Optional[str]) -> List[str]:
    """Landing pages of popular sites: the page a visitor actually ends up on,
    and the site's bare address. Only the dataset's small consent file is read."""
    path = _download(POPULAR_SITES, lambda name: name.endswith("cookie_warning_consents.parquet"), token)[0]
    frame = pd.read_parquet(path)
    urls: List[str] = []
    for column in ("url", "crawled_url"):
        if column in frame.columns:
            urls += frame[column].tolist()
    return clean_urls(urls)


def load_phishing_reference(token: Optional[str]) -> Dict[str, Dict[str, List[str]]]:
    out = {}
    for split in ("train", "test"):
        path = _download(PHISHING_REFERENCE, lambda name, split=split: name == f"data/{split}.parquet", token)[0]
        frame = pd.read_parquet(path, columns=["url", "status"])
        out[split] = {status: clean_urls(frame.loc[frame["status"] == status, "url"].tolist()) for status in ("legitimate", "phishing")}
    return out


def load_payloads(token: Optional[str]) -> Dict[str, List[str]]:
    paths = _download(ATTACK_PAYLOADS, lambda name: name in ("train.csv", "validate.csv", "test.csv"), token)
    frame = pd.concat([pd.read_csv(path) for path in paths], ignore_index=True)
    text_column = "Payload" if "Payload" in frame.columns else frame.select_dtypes(include="object").columns[0]
    if "text_label" in frame.columns:
        labels = frame["text_label"].astype(str).str.lower()
    else:
        labels = frame["Label"].map({0: "normal", 1: "xss", 2: "sqli"}).astype(str)
    out = {"attack": [], "normal": []}
    seen = set()
    for text, label in zip(frame[text_column].tolist(), labels.tolist()):
        if not isinstance(text, str):
            continue
        text = text.strip()
        if not text or len(text) > 600 or text in seen:
            continue
        seen.add(text)
        out["normal" if label == "normal" else "attack"].append(text)
    return out


def load_popular_domains(limit: int, fallback_urls: List[str]) -> Dict:
    """The most-visited domains in rank order, from the public Tranco list. If
    the list cannot be fetched, the domains of the popular-sites crawl are used
    in the order they appear, and the report says so."""
    try:
        with urllib.request.urlopen(urllib.request.Request(TRANCO_LIST, headers={"User-Agent": "cyberforge-trainer"}), timeout=180) as response:
            text = response.read().decode("utf-8", "replace")
        domains = [line.split(",", 1)[1].strip().lower() for line in text.splitlines() if "," in line][: int(limit)]
        if len(domains) < 1000:
            raise TrainingError(f"the list has only {len(domains)} rows")
        return {"domains": domains, "source": TRANCO_LIST, "count": len(domains)}
    except Exception as error:
        seen, domains = set(), []
        for url in fallback_urls:
            domain = registered_domain(url)
            if domain and domain not in seen:
                seen.add(domain)
                domains.append(domain)
        domains = domains[: int(limit)]
        return {"domains": domains, "count": len(domains),
                "source": f"{POPULAR_SITES} (fallback, unranked; the Tranco list could not be fetched: {type(error).__name__}: {str(error)[:120]})"}


def labelled(parts: Dict[str, List[str]]) -> List[tuple]:
    """[(url, source), ...] from {source: [urls]}, each URL once."""
    seen, rows = set(), []
    for source, urls in parts.items():
        for url in urls:
            key = bare_url(url).lower()
            if key and key not in seen:
                seen.add(key)
                rows.append((url, source))
    return rows


def compose_url(base: str, payload: str, rng: random.Random) -> str:
    """Put a payload where one arrives in practice: as a query value on an
    ordinary site, encoded or not, or (less often) in the path."""
    parts = split_url("//" + bare_url(base))
    host = parts["hostname"] or "example.com"
    path = parts["path"] if parts["path"] and len(parts["path"]) < 60 else "/"
    carried = quote(payload, safe="") if rng.random() < 0.5 else payload.replace(" ", "+" if rng.random() < 0.5 else " ")
    if rng.random() < 0.15:
        return f"{host}{path.rstrip('/')}/{carried}"
    extra = f"&{rng.choice(PARAMETERS)}={rng.randint(1, 500)}" if rng.random() < 0.3 else ""
    return f"{host}{path}?{rng.choice(PARAMETERS)}={carried}{extra}"


# The {domain: rank} table this run scores URLs with. It is the run's own:
# training never changes the table the service is answering requests with.
POPULAR: Dict[str, int] = {}


def feature_table(urls: List[str]) -> np.ndarray:
    """One row of every feature per URL."""
    table = np.zeros((len(urls), len(ALL_FEATURES)), dtype=np.float32)
    for index, url in enumerate(urls):
        features = extract_url_features(url, POPULAR)
        table[index] = [features.get(name, 0) or 0 for name in ALL_FEATURES]
    return table


def columns(names: List[str]) -> List[int]:
    return [ALL_FEATURES.index(name) for name in names]


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def measure(truth: np.ndarray, scores: np.ndarray) -> Dict:
    predicted = scores >= 0.5
    truth = truth.astype(bool)
    tp = int(np.sum(predicted & truth))
    fp = int(np.sum(predicted & ~truth))
    fn = int(np.sum(~predicted & truth))
    tn = int(np.sum(~predicted & ~truth))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    both = bool(truth.any() and (~truth).any())
    return {
        "samples": int(len(truth)), "positives": int(truth.sum()),
        "true_positives": tp, "false_positives": fp, "false_negatives": fn, "true_negatives": tn,
        "precision": round(precision, 4), "recall": round(recall, 4),
        "f1": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
        "false_positive_rate": round(fp / (fp + tn), 4) if fp + tn else 0.0,
        "auc": round(float(roc_auc_score(truth, scores)), 4) if both else None,
        "average_precision": round(float(average_precision_score(truth, scores)), 4) if both else None,
    }


def rescale(scores: np.ndarray, threshold: float) -> np.ndarray:
    return np.array([rescale_score(float(score), threshold) for score in scores])


def score_urls(model, names: List[str], urls: List[str], threshold: float = 0.5) -> List[Dict]:
    if not urls:
        return []
    table = feature_table(urls)[:, columns(names)]
    scores = rescale(model.predict_proba(table)[:, 1], threshold)
    return [{"url": url, "score": round(float(score), 4)} for url, score in zip(urls, scores)]


def train_classifier(name: str, positives: Dict[str, List[str]], negatives: Dict[str, List[str]], names: List[str],
                     settings: Dict, extra_tests: Optional[Dict[str, Dict[str, List[str]]]] = None) -> Dict:
    """Fit one classifier and measure it on sites it did not train on.
    `positives` and `negatives` are {source: [urls]}; results are also broken
    down by source, so one source cannot hide behind another."""
    negative_rows, positive_rows = labelled(negatives), labelled(positives)
    # a URL listed on both sides teaches nothing; drop it from both
    clash = {bare_url(url).lower() for url, _ in negative_rows} & {bare_url(url).lower() for url, _ in positive_rows}
    negative_rows = [row for row in negative_rows if bare_url(row[0]).lower() not in clash]
    positive_rows = [row for row in positive_rows if bare_url(row[0]).lower() not in clash]

    urls = [url for url, _ in negative_rows + positive_rows]
    sources = np.array([source for _, source in negative_rows + positive_rows])
    labels = np.array([0] * len(negative_rows) + [1] * len(positive_rows))
    groups = np.array([registered_domain(url) for url in urls])
    splitter = GroupShuffleSplit(n_splits=1, test_size=settings["test_fraction"], random_state=settings["seed"])
    train_index, test_index = next(splitter.split(urls, labels, groups))
    # A tenth of the training sites is set aside to choose the decision point.
    # It is not the held-out test: the test sites take no part in any choice.
    chooser = GroupShuffleSplit(n_splits=1, test_size=0.1, random_state=settings["seed"] + 1)
    fit_part, choose_part = next(chooser.split(train_index, labels[train_index], groups[train_index]))
    fit_index, choose_index = train_index[fit_part], train_index[choose_part]

    table = feature_table(urls)[:, columns(names)]
    model = HistGradientBoostingClassifier(
        max_iter=int(settings["max_iter"]), learning_rate=float(settings["learning_rate"]),
        max_leaf_nodes=int(settings["max_leaf_nodes"]), min_samples_leaf=int(settings["min_samples_leaf"]),
        l2_regularization=float(settings["l2_regularization"]), class_weight="balanced",
        early_stopping=True, validation_fraction=0.1, n_iter_no_change=15, random_state=settings["seed"],
    )
    started = time.time()
    model.fit(table[fit_index], labels[fit_index])
    seconds = round(time.time() - started, 1)

    # The decision point: the raw score that the target share of benign
    # validation URLs stays under. Never below 0.5, so a model that is already
    # stricter than the target is left as it is. Scores are then rescaled so
    # that this point reads as 0.5, like every other model in the service.
    choose_scores = model.predict_proba(table[choose_index])[:, 1]
    benign_scores = choose_scores[labels[choose_index] == 0]
    target = float(settings["target_false_positive_rate"])
    threshold = 0.5
    if len(benign_scores) >= 200 and 0.0 < target < 1.0:
        threshold = float(min(0.99, max(0.5, np.quantile(benign_scores, 1.0 - target))))

    raw_test_scores = model.predict_proba(table[test_index])[:, 1]
    test_scores = rescale(raw_test_scores, threshold)
    holdout = measure(labels[test_index], test_scores)
    holdout["at_raw_0.5"] = {key: value for key, value in measure(labels[test_index], raw_test_scores).items()
                             if key in ("precision", "recall", "false_positive_rate")}
    by_source = {}
    for source in sorted(set(sources[test_index])):
        mask = sources[test_index] == source
        flagged = float(np.mean(test_scores[mask] >= 0.5))
        positive = bool(labels[test_index][mask][0])
        by_source[source] = {"urls": int(mask.sum()), "kind": "positive" if positive else "negative",
                             ("recall" if positive else "false_positive_rate"): round(flagged, 4)}
    report = {
        "model_type": "HistGradientBoostingClassifier",
        "feature_names": names,
        "feature_dtype": "float32",
        "uses_scaler": False,
        "decision_threshold": round(threshold, 6),
        "decision_point": {"target_false_positive_rate": target, "validation_urls": int(len(choose_index)),
                           "validation_benign": int(len(benign_scores)),
                           "note": "raw scores are rescaled so that this threshold reads as 0.5"},
        "training": {
            "rows": int(len(fit_index)), "positives": int(labels[fit_index].sum()),
            "sites": int(len(set(groups[train_index]))), "seconds": seconds, "iterations": int(model.n_iter_),
            "rows_by_source": {source: int(np.sum(sources[train_index] == source)) for source in sorted(set(sources))},
            "dropped_as_listed_on_both_sides": len(clash),
        },
        "holdout": {**holdout, "sites": int(len(set(groups[test_index]))), "by_source": by_source,
                    "note": "URLs from sites that were not in the training rows"},
        "other_datasets": {},
    }
    for label, parts in (extra_tests or {}).items():
        other_urls = parts["negatives"] + parts["positives"]
        if not other_urls:
            continue
        other_truth = np.array([0] * len(parts["negatives"]) + [1] * len(parts["positives"]))
        other_scores = rescale(model.predict_proba(feature_table(other_urls)[:, columns(names)])[:, 1], threshold)
        report["other_datasets"][label] = measure(other_truth, other_scores)

    legitimate = score_urls(model, names, KNOWN_LEGITIMATE, threshold)
    report["known_legitimate"] = {
        "checked": len(legitimate),
        "flagged": [entry for entry in legitimate if entry["score"] >= 0.5],
        "highest": sorted(legitimate, key=lambda entry: -entry["score"])[:5],
    }
    report["known_hostile"] = score_urls(model, names, KNOWN_HOSTILE.get(name, []), threshold)
    if name == "phishing_detection":
        report["hostile_on_popular_platforms"] = score_urls(model, names, KNOWN_HOSTILE["phishing on a popular platform"], threshold)

    # Which features the model leans on, measured by shuffling each one. The
    # held-out rows are sampled at random: taken in order they would all be benign.
    sample = np.random.default_rng(settings["seed"]).choice(test_index, size=min(4000, len(test_index)), replace=False)
    try:
        importance = permutation_importance(model, table[sample], labels[sample], n_repeats=3,
                                            random_state=settings["seed"], scoring="roc_auc")
        ranked = sorted(zip(names, importance.importances_mean), key=lambda pair: -pair[1])
        report["feature_importances"] = {feature: round(float(value), 5) for feature, value in ranked}
    except Exception as error:  # the importances are for the explain endpoint; training does not depend on them
        report["feature_importances_error"] = f"{type(error).__name__}: {error}"

    reasons, failed = [], []
    if holdout["auc"] is None or holdout["auc"] < GATE["min_auc"]:
        reasons.append(f"held-out AUC {holdout['auc']} is below {GATE['min_auc']}")
        failed.append("min_auc")
    if holdout["false_positive_rate"] > GATE["max_false_positive_rate"]:
        reasons.append(f"held-out false-positive rate {holdout['false_positive_rate']} is above {GATE['max_false_positive_rate']}")
        failed.append("max_false_positive_rate")
    if len(report["known_legitimate"]["flagged"]) > GATE["max_known_legitimate_flagged"]:
        reasons.append(f"{len(report['known_legitimate']['flagged'])} well-known legitimate URL(s) scored 0.5 or more")
        failed.append("max_known_legitimate_flagged")
    report["gate"] = {"rules": GATE, "passed": not reasons, "reasons": reasons, "failed_rules": failed}
    return {"model": model, "report": report}


def train_anomaly(benign: List[str], malicious: List[str], names: List[str], settings: Dict) -> Dict:
    """Fit the IsolationForest on benign URLs only and measure what it flags."""
    groups = np.array([registered_domain(url) for url in benign])
    splitter = GroupShuffleSplit(n_splits=1, test_size=settings["test_fraction"], random_state=settings["seed"])
    train_index, test_index = next(splitter.split(benign, groups=groups))
    table = feature_table(benign)[:, columns(names)]
    model = IsolationForest(n_estimators=200, contamination=float(settings["anomaly_contamination"]),
                            random_state=settings["seed"], n_jobs=2)
    started = time.time()
    model.fit(table[train_index])
    seconds = round(time.time() - started, 1)

    def flagged(urls: List[str]) -> float:
        if not urls:
            return 0.0
        return round(float(np.mean(model.decision_function(feature_table(urls)[:, columns(names)]) < 0)), 4)

    benign_margins = model.decision_function(table[test_index])
    benign_flagged = round(float(np.mean(benign_margins < 0)), 4)
    malicious_sample = malicious[:20000]
    malicious_flagged = flagged(malicious_sample)
    legitimate_margins = model.decision_function(feature_table(KNOWN_LEGITIMATE)[:, columns(names)])
    report = {
        "model_type": "IsolationForest",
        "feature_names": names,
        "feature_dtype": "float32",
        "uses_scaler": False,
        "training": {"rows": int(len(train_index)), "seconds": seconds, "contamination": float(settings["anomaly_contamination"])},
        "holdout": {
            "benign_urls": int(len(test_index)), "benign_flagged": benign_flagged,
            "benign_margin_percentiles": {str(p): round(float(np.percentile(benign_margins, p)), 4) for p in (1, 5, 25, 50, 75, 95)},
            "malicious_urls": len(malicious_sample), "malicious_flagged": malicious_flagged,
            "note": "the model never saw malicious URLs; these are how often it calls each kind unusual",
        },
        "known_legitimate": {
            "checked": len(KNOWN_LEGITIMATE),
            "flagged": [{"url": url, "margin": round(float(margin), 4)} for url, margin in zip(KNOWN_LEGITIMATE, legitimate_margins) if margin < 0],
        },
    }
    reasons = []
    if benign_flagged > ANOMALY_GATE["max_benign_flagged"]:
        reasons.append(f"it flags {benign_flagged} of held-out benign URLs, above {ANOMALY_GATE['max_benign_flagged']}")
    if malicious_flagged < ANOMALY_GATE["min_malicious_flagged"] or malicious_flagged < ANOMALY_GATE["min_ratio"] * benign_flagged:
        reasons.append(f"it flags {malicious_flagged} of malicious URLs against {benign_flagged} of benign ones, which is not a useful separation")
    report["gate"] = {"rules": ANOMALY_GATE, "passed": not reasons, "reasons": reasons}
    return {"model": model, "report": report}


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------

def run_training(options: Dict, token: Optional[str], model_repo: str, progress: Callable[[str], None]) -> Dict:
    """Train, measure and (unless `dry_run`) upload the models that pass.

    Returns {"reports": {...}, "models": {name: fitted model that passed},
    "uploaded": {...}}. Raises nothing for a model that fails its gate: its
    report says why, and the model in service is left as it is."""
    settings = {**DEFAULTS, **{key: options[key] for key in DEFAULTS if key in options}}
    wanted = options.get("models") or ["phishing_detection", "malware_detection", "web_attack_detection", "anomaly_detection"]
    dry_run = bool(options.get("dry_run", False))
    rng = random.Random(settings["seed"])
    # Features a run is asked to leave out, to measure whether a model depends
    # on something it should not. The list is recorded with the model.
    overrides = options.get("accept_despite_gate") if isinstance(options.get("accept_despite_gate"), dict) else {}
    dropped = [name for name in (options.get("drop_features") or []) if isinstance(name, str)]
    lexical = [name for name in LEXICAL_FEATURES if name not in dropped]
    attack = [name for name in ATTACK_FEATURES if name not in dropped]
    settings["drop_features"] = dropped

    progress("downloading data")
    phishing = load_phishing_collection(token)
    collection = load_url_collection(token)
    reference = load_phishing_reference(token)
    popular = load_popular_sites(token)
    payloads = load_payloads(token) if "web_attack_detection" in wanted else {"attack": [], "normal": []}
    reputation = load_popular_domains(settings["popular_domains"], popular)
    global POPULAR
    POPULAR = build_popularity(reputation["domains"])
    sources = {
        "domain popularity": {"source": reputation["source"], "domains": reputation["count"]},
        PHISHING_COLLECTION: {"revision": _revision(PHISHING_COLLECTION, token), "rows": {kind: len(urls) for kind, urls in phishing.items()}},
        URL_COLLECTION: {"revision": _revision(URL_COLLECTION, token), "rows": {kind: len(urls) for kind, urls in collection.items()}},
        PHISHING_REFERENCE: {"revision": _revision(PHISHING_REFERENCE, token),
                             "rows": {split: {status: len(urls) for status, urls in parts.items()} for split, parts in reference.items()}},
        POPULAR_SITES: {"revision": _revision(POPULAR_SITES, token), "rows": {"landing pages": len(popular)}},
        ATTACK_PAYLOADS: {"revision": _revision(ATTACK_PAYLOADS, token), "rows": {kind: len(texts) for kind, texts in payloads.items()}},
    }

    def sample(items: List[str], size: int) -> List[str]:
        items = list(items)
        rng.shuffle(items)
        return items[: int(size)]

    # URLs of the reference test split must not be trained on.
    reference_test = {bare_url(url).lower() for part in reference["test"].values() for url in part}
    keep = lambda urls: [url for url in urls if bare_url(url).lower() not in reference_test]  # noqa: E731

    # Benign URLs of several shapes, so that no model can tell benign from
    # hostile by how one list happens to be written: deep links, short
    # addresses and bare domains, landing pages of popular sites.
    benign = {
        "phishing collection, benign": keep(sample(phishing["benign"], settings["benign_sample"])),
        "older collection, benign": keep(sample(collection["benign"], settings["collection_benign_sample"])),
        "popular sites": keep(sample(popular, settings["popular_sample"])),
        "reference, legitimate": keep(reference["train"]["legitimate"]),
    }
    all_benign = [url for urls in benign.values() for url in urls]

    results: Dict[str, Dict] = {}

    if "phishing_detection" in wanted:
        progress("training phishing_detection")
        positives = {
            "phishing collection, phishing": keep(sample(phishing["phishing"], settings["phishing_sample"])),
            "reference, phishing": keep(reference["train"]["phishing"]),
        }
        results["phishing_detection"] = train_classifier(
            "phishing_detection", positives, benign, lexical, settings,
            extra_tests={PHISHING_REFERENCE + " (test split)": {"negatives": reference["test"]["legitimate"], "positives": reference["test"]["phishing"]}})

    if "malware_detection" in wanted:
        progress("training malware_detection")
        positives = {"older collection, malware": sample(collection["malware"], settings["malware_sample"])}
        results["malware_detection"] = train_classifier("malware_detection", positives, benign, lexical, settings)

    if "web_attack_detection" in wanted:
        progress("training web_attack_detection")
        if not payloads["attack"]:
            raise TrainingError("No attack payloads were loaded")
        bases = sample(all_benign, settings["attack_benign_sample"])
        with_query = [url for url in phishing["benign"] + collection["benign"] if "?" in url]
        ordinary = {
            **benign,
            "benign URLs with a query": keep(sample(with_query, settings["attack_benign_sample"])),
            "normal strings placed like payloads": [compose_url(rng.choice(bases), text, rng) for text in payloads["normal"]],
        }
        # each payload is carried on two different sites, so the model cannot learn a site
        attacks = {"payloads placed on benign sites": [compose_url(rng.choice(bases), text, rng) for text in payloads["attack"] for _ in range(2)]}
        results["web_attack_detection"] = train_classifier("web_attack_detection", attacks, ordinary, attack, settings)
        results["web_attack_detection"]["report"]["training"]["note"] = (
            "attack rows are real SQL-injection and XSS payloads placed as a query value or path segment on benign sites")

    if "anomaly_detection" in wanted:
        progress("training anomaly_detection")
        malicious = sample(phishing["phishing"], 10000) + sample(collection["malware"], 10000)
        results["anomaly_detection"] = train_anomaly(clean_urls(all_benign), malicious, lexical, settings)

    trained_at = datetime.utcnow().isoformat() + "Z"
    reports, accepted = {}, {}
    for name, result in results.items():
        report = result["report"]
        report.update({"name": name, "trained_at": trained_at, "settings": settings, "sources": sources,
                       "feature_set": "url_features.py, scheme-free and without a leading www."})
        reports[name] = report
        if report["gate"]["passed"]:
            accepted[name] = result["model"]
            continue
        # The gate is not loosened for anyone. The owner can still decide to put
        # a classifier into service when the only rule it fails is the list of
        # well-known legitimate URLs, the measured rules having passed. The
        # decision, its reason and what was failed are written into the model's
        # metadata, where anyone reading the model later will find them.
        reason = overrides.get(name)
        if isinstance(reason, str) and len(reason.strip()) >= 20 and report["gate"].get("failed_rules") == ["max_known_legitimate_flagged"]:
            report["gate"]["accepted_by_owner"] = {
                "reason": reason.strip()[:600], "decided_at": trained_at,
                "exceptions": report["known_legitimate"]["flagged"],
            }
            accepted[name] = result["model"]
        elif reason:
            report["gate"]["override_refused"] = (
                "an owner decision can only accept a classifier whose measured rules passed and whose only failure is the "
                "well-known legitimate URLs, and it needs a reason of at least 20 characters")

    uploaded = {}
    if accepted and not dry_run:
        progress("uploading accepted models")
        api = HfApi(token=token)
        try:
            previous = api.model_info(model_repo).sha
        except Exception:
            previous = None
        with tempfile.TemporaryDirectory() as folder:
            for name, model in accepted.items():
                target = Path(folder) / name
                target.mkdir(parents=True)
                joblib.dump(model, target / "best_model.pkl", compress=3)
                (target / "metadata.json").write_text(json.dumps(reports[name], indent=2), encoding="utf-8")
                commit = api.upload_folder(
                    folder_path=str(target), path_in_repo=name, repo_id=model_repo, repo_type="model",
                    commit_message=f"Retrain {name} on public labelled data ({trained_at[:10]})",
                    # the scaler and the older model files belong to the previous model and would not fit this one
                    delete_patterns=["scaler.pkl", "model.pkl", "package_info.json"],
                )
                uploaded[name] = getattr(commit, "oid", None) or str(commit)
            # The list the popularity feature was computed with travels with the
            # models: the service must score URLs with exactly this list.
            if any("domain_popularity" in reports[name]["feature_names"] for name in accepted):
                target = Path(folder) / "reputation"
                target.mkdir(parents=True)
                (target / "popular_domains.txt").write_text("\n".join(reputation["domains"]) + "\n", encoding="utf-8")
                (target / "metadata.json").write_text(json.dumps(
                    {"source": reputation["source"], "domains": reputation["count"], "saved_at": trained_at}, indent=2), encoding="utf-8")
                commit = api.upload_folder(folder_path=str(target), path_in_repo="reputation", repo_id=model_repo, repo_type="model",
                                           commit_message=f"Domain popularity list used by the models trained {trained_at[:10]}")
                uploaded["reputation"] = getattr(commit, "oid", None) or str(commit)
        uploaded["previous_revision"] = previous

    progress("finished")
    return {"reports": reports, "models": {} if dry_run else accepted, "uploaded": uploaded, "dry_run": dry_run,
            "popular_domains": [] if dry_run or not accepted else reputation["domains"]}


def describe_failure(error: BaseException) -> str:
    return "".join(traceback.format_exception(type(error), error, error.__traceback__))[-4000:]
