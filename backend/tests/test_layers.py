"""Layer rule: the generic engine must never import any other AEGIS layer."""

import ast
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[1] / "aegis" / "engine"


def test_engine_imports_no_other_aegis_layer():
    offenders = []
    for path in ENGINE_DIR.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = []
            if isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            elif isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            for name in names:
                if name.startswith("aegis.") and not name.startswith("aegis.engine"):
                    offenders.append(f"{path.name}: {name}")
    assert not offenders, offenders
