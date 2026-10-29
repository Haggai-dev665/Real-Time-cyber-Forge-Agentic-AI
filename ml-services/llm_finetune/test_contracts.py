"""Lightweight regression checks; no torch installation or GPU required."""
import ast
import unittest
import os
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
from pathlib import Path
from serving import PROMPTS, prompt_text

HERE = Path(__file__).resolve().parent


class Contracts(unittest.TestCase):
    def test_cpu_evaluation_stages_never_enter_gpu_setup(self):
        shell = "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash")
        with tempfile.TemporaryDirectory(dir=HERE / "runs") as tmp:
            (Path(tmp) / "bundle/llm_finetune").mkdir(parents=True)
            for stage in ("evaluate", "release", "groundcheck", "constrained"):
                env = {**os.environ, "STAGE": stage, "BUNDLE_REPO": "test/test",
                       "BUNDLE_REVISION": "test", "CF_WORK_DIR": Path(tmp).as_posix(),
                       "CF_SCRIPT": (HERE / "hf_job.sh").as_posix()}
                script = '''
hf() { :; }
pip() { :; }
apt-get() { :; }
python() { printf '%s\\n' "$*"; }
nvidia-smi() { echo 'unexpected GPU branch'; return 99; }
mkdir() { :; }
source "$CF_SCRIPT"
'''
                result = subprocess.run([shell, "-c", script], env=env, capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), "cloud_evaluate.py")

    def test_evaluation_dependency_stops_on_failed_training(self):
        tree = ast.parse((HERE / "cloud_evaluate.py").read_text(encoding="utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "wait_for_training")
        scope = {"time": SimpleNamespace(monotonic=lambda: 1)}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "wait", "exec"), scope)
        for stage in ("ERROR", "CANCELED"):
            api = SimpleNamespace(inspect_job=lambda **kw: SimpleNamespace(status=SimpleNamespace(stage=stage)))
            with self.assertRaises(RuntimeError):
                scope["wait_for_training"](api, "job", "owner", 10)
        api = SimpleNamespace(inspect_job=lambda **kw: SimpleNamespace(status=SimpleNamespace(stage="RUNNING")))
        with self.assertRaises(TimeoutError):
            scope["wait_for_training"](api, "job", "owner", 0)
        api = SimpleNamespace(inspect_job=lambda **kw: SimpleNamespace(status=SimpleNamespace(stage="COMPLETED")))
        scope["wait_for_training"](api, "job", "owner", 0)

    def test_training_prompts_match_deployed_source(self):
        tree = ast.parse((HERE.parent / "hf_space_deploy" / "app.py").read_text(encoding="utf-8"))
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "TransformerModelLoader")
        constants = {n.targets[0].id: ast.literal_eval(n.value) for n in cls.body
                     if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
                     and n.targets[0].id in ("SYSTEM_PROMPT", "ASSISTANT_PROMPT")}
        self.assertEqual(constants["SYSTEM_PROMPT"], PROMPTS["analyst"])
        self.assertEqual(constants["ASSISTANT_PROMPT"], PROMPTS["assistant"])

    def test_answer_budget_and_masking(self):
        tree = ast.parse((HERE / "train_lora.py").read_text(encoding="utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "encode")
        scope = {"prompt_text": prompt_text}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "encode", "exec"), scope)
        # Character tokens make the boundary exact and deterministic.
        tok = lambda text, **kw: {"input_ids": list(range(len(text)))}
        row = {"id": "budget", "messages": [{"content": x} for x in ("system", "user", "answer")]}
        encoded = scope["encode"](tok, row, 30)
        self.assertEqual(len(encoded["input_ids"]), 30)
        self.assertEqual(encoded["labels"][:14], [-100] * 14)
        with self.assertRaises(ValueError):
            scope["encode"](tok, row, 16)

    def test_required_bundle_assets_exist(self):
        for name in ("MODEL_CARD.md", "evaluate.py", "prepare_cloud_data.py", "hf_job.sh"):
            self.assertTrue((HERE / name).is_file(), name)
        for name in ("hf_job.sh", "export_gguf.sh"):
            self.assertNotIn(b"\r", (HERE / name).read_bytes(), name)


if __name__ == "__main__":
    unittest.main()
