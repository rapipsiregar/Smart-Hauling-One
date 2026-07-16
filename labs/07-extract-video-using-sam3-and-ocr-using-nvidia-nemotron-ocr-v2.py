#!/usr/bin/env python3
"""End-to-end: extract frames from video, segment truck IDs with SAM3, Nemotron OCR v2."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
LABS_DIR = Path(__file__).resolve().parent
MAIN_VENV_PYTHON = ROOT / ".venv" / "bin" / "python"
SLUG = "extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2"
OUTPUT_DIR = ROOT / "data" / f"07-{SLUG}"
OCR_BACKEND = "nvidia-nemotron-ocr-v2"
NEMOTRON_PYTHON = ROOT / ".venv-nemotron" / "bin" / "python"


def ensure_main_python() -> None:
    if MAIN_VENV_PYTHON.exists() and Path(sys.executable).resolve() != MAIN_VENV_PYTHON.resolve():
        os.execv(str(MAIN_VENV_PYTHON), [str(MAIN_VENV_PYTHON), *sys.argv])


def import_lab_module(filename: str):
    path = LABS_DIR / filename
    module_name = path.stem.replace("-", "_")
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load lab module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class NemotronSubprocessPipeline:
    def __init__(
        self,
        lang: str,
        model_dir: Path | None,
        skip_relational: bool,
    ) -> None:
        self.lang = lang
        self.model_dir = str(model_dir) if model_dir is not None else None
        self.skip_relational = skip_relational

    def __call__(self, image_path: str, merge_level: str = "word") -> list[dict[str, Any]]:
        if not NEMOTRON_PYTHON.exists():
            raise SystemExit(
                "Nemotron OCR is not installed. Create the env and install the package:\n"
                "  uv venv .venv-nemotron --python 3.12\n"
                "  uv pip install --python .venv-nemotron/bin/python torch torchvision "
                "--index-url https://download.pytorch.org/whl/cu126\n"
                "  uv pip install --python .venv-nemotron/bin/python hatchling editables setuptools ninja\n"
                "  CUDA_HOME=/usr/local/cuda-12.6 uv pip install --python .venv-nemotron/bin/python "
                "--no-build-isolation ./nemotron-ocr-v2/nemotron-ocr"
            )

        runner = """
import json
import sys
from pathlib import Path

from nemotron_ocr.inference.pipeline_v2 import NemotronOCRV2

lang = sys.argv[1]
model_dir = sys.argv[2] or None
skip_relational = sys.argv[3] == "1"
image_path = sys.argv[4]
merge_level = sys.argv[5]

kwargs = {"skip_relational": skip_relational}
if model_dir:
    kwargs["model_dir"] = model_dir
else:
    kwargs["lang"] = lang

pipeline = NemotronOCRV2(**kwargs)
predictions = pipeline(image_path, merge_level=merge_level)
print(json.dumps(predictions))
"""
        result = subprocess.run(
            [
                str(NEMOTRON_PYTHON),
                "-c",
                runner,
                self.lang,
                self.model_dir or "",
                "1" if self.skip_relational else "0",
                image_path,
                merge_level,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)


def patch_nemotron_for_subprocess() -> None:
    lab05 = import_lab_module("05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py")
    lab05.ensure_nemotron_python = lambda: None
    lab05.build_pipeline = lambda lang, model_dir, skip_relational: NemotronSubprocessPipeline(
        lang,
        model_dir,
        skip_relational,
    )


def argv_with_defaults(user_args: list[str]) -> list[str]:
    defaults = [
        "--ocr-backend",
        OCR_BACKEND,
        "--output-dir",
        str(OUTPUT_DIR),
    ]
    return [*defaults, *user_args]


def main() -> int:
    ensure_main_python()
    os.environ["NEMOTRON_OCR_SUBPROCESS"] = "1"
    patch_nemotron_for_subprocess()
    lab06 = import_lab_module("06-extract-video-using-sam3-and-ocr.py")
    sys.argv = [sys.argv[0], *argv_with_defaults(sys.argv[1:])]
    return lab06.main()


if __name__ == "__main__":
    sys.exit(main())
