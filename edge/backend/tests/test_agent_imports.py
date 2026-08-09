"""Every module the device runs must actually import.

The rest of the suite exercises the parts that can be tested without a Jetson --
the window state machine, the outbox, the local API -- and never imports the
threads that do the detecting. That gap let ``agent/consensus.py`` and
``agent/inference.py`` sit broken through a full green run: both reached into the
core's ``labs/custom_model`` via a sys.path hack whose path stopped existing when
the repo was split into ``core/`` + ``edge/``. Nothing noticed until an agent was
started for real and died with ``No module named 'custom_model'`` -- meaning no
gate would have detected anything.

So: import them all, and forbid the shape of the bug as well as the bug.
"""

from __future__ import annotations

import ast
import importlib
from pathlib import Path

import pytest

EDGE_BACKEND = Path(__file__).resolve().parents[1]

# cv2/numpy arrive with the `inference` extra. The dev container deliberately
# omits them (SMART_GATE_RUN_AGENT=false), so importing there proves nothing.
_HAS_VISION_DEPS = importlib.util.find_spec("cv2") is not None


def _modules_under(package: str) -> list[str]:
    root = EDGE_BACKEND / package
    return sorted(
        f"{package}." + str(path.relative_to(root).with_suffix("")).replace("/", ".")
        for path in root.rglob("*.py")
        if "__pycache__" not in path.parts and path.name != "__init__.py"
    )


DEVICE_MODULES = _modules_under("agent") + _modules_under("app")


@pytest.mark.skipif(not _HAS_VISION_DEPS, reason="cv2 not installed (inference extra)")
@pytest.mark.parametrize("module", DEVICE_MODULES)
def test_device_module_imports(module: str):
    importlib.import_module(module)


# Top-level packages that only ever exist inside core/. Prose may cite them as
# provenance -- only a real import is the defect, so this reads the AST.
CORE_ONLY_PACKAGES = {"custom_model", "labs", "core"}


def _imported_roots(source: str) -> set[str]:
    roots = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


@pytest.mark.parametrize("module", DEVICE_MODULES)
def test_no_module_reaches_into_core(module: str):
    """The edge deploys without core/ on disk -- so it must not import from it."""
    source = (EDGE_BACKEND / (module.replace(".", "/") + ".py")).read_text("utf-8")
    offenders = _imported_roots(source) & CORE_ONLY_PACKAGES
    assert not offenders, (
        f"{module} imports {sorted(offenders)}, which only exist in core/. "
        "Import the byte-identical copy from vendor/ instead -- the edge must run "
        "on a Jetson that has never seen core/."
    )


# --- device selection ---------------------------------------------------------
# InferenceLoop asked for "cuda" unconditionally. On a machine whose torch is the
# CPU wheel that raises inside the thread, killing it -- while every other thread
# lived on and the gate went on reporting a healthy agent that detected nothing.

def test_cpu_is_honoured_verbatim():
    from agent.inference import resolve_device

    assert resolve_device("cpu") == "cpu"


def test_cuda_falls_back_when_torch_has_no_cuda(monkeypatch):
    import sys
    import types

    from agent import inference

    fake = types.ModuleType("torch")
    fake.cuda = types.SimpleNamespace(is_available=lambda: False)
    monkeypatch.setitem(sys.modules, "torch", fake)

    assert inference.resolve_device("cuda") == "cpu"


def test_cuda_is_kept_when_the_machine_has_it(monkeypatch):
    import sys
    import types

    from agent import inference

    fake = types.ModuleType("torch")
    fake.cuda = types.SimpleNamespace(is_available=lambda: True)
    monkeypatch.setitem(sys.modules, "torch", fake)

    assert inference.resolve_device("cuda") == "cuda"


def test_env_var_overrides_the_default(monkeypatch):
    from agent.inference import resolve_device

    monkeypatch.setenv("SMART_GATE_DEVICE", "cpu")
    assert resolve_device() == "cpu"


def test_a_model_load_failure_is_reported_not_swallowed():
    """The thread must exit loudly enough for the status endpoint to show it."""
    import queue

    from agent.config import Tunables, TunableStore
    from agent.inference import InferenceLoop

    reported: list[str] = []
    loop = InferenceLoop(
        ring=None,
        tunables=TunableStore(Tunables()),
        finalizer_queue=queue.Queue(),
        settings=None,
        device="cpu",
        on_error=reported.append,
    )
    loop._load_models = lambda: (_ for _ in ()).throw(RuntimeError("no weights"))

    loop.run()

    assert reported and "no weights" in reported[0]
