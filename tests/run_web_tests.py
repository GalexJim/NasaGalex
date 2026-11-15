"""Ejecuta todas las pruebas de navegador (Playwright) una tras otra y resume el resultado.

Requisitos: pip install playwright (usa el Edge/Chrome instalado; no descarga navegadores).
Uso:
    python tests/run_web_tests.py            # todas
    python tests/run_web_tests.py e2e fase4  # solo algunas

El servidor de la prueba de la Fase 4 usa su propio Python (el primero que tenga yaml, numpy y scipy); se puede
forzar con la variable MARS_SERVER_PYTHON.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUITES = {
    "fase1": "Radiación (capa, indicador, alerta crítica, regreso al refugio)",
    "fase2": "Confianza del modelo y limitaciones",
    "fase3": "Jornada EVA configurable y soles",
    "fase4": "Avisos compartidos (file://, backend, SQLite, JSONL)",
    "e2e": "Recorrido completo de extremo a extremo",
}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows usa cp1252 por defecto
    chosen = [a for a in sys.argv[1:] if a in SUITES] or list(SUITES)
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    rows, failed = [], False
    for name in chosen:
        script = HERE / ("web_e2e.py" if name == "e2e" else f"web_{name}.py")
        t0 = time.time()
        out = subprocess.run([sys.executable, str(script)], capture_output=True, text=True, encoding="utf-8", env=env, cwd=str(HERE.parent))
        m = re.findall(r"(\d+)/(\d+) comprobaciones correctas", out.stdout)
        ok = out.returncode == 0 and bool(m)
        failed |= not ok
        rows.append((name, SUITES[name], f"{m[-1][0]}/{m[-1][1]}" if m else "sin resultado", "OK" if ok else "FALLA", time.time() - t0))
        if not ok:
            print(f"--- {name}: salida ---\n" + "\n".join(l for l in out.stdout.splitlines() if l.startswith("FALLA")) + "\n" + out.stderr[-1500:])
    print("\nResumen de pruebas de navegador")
    for name, desc, res, st, secs in rows:
        print(f"  {st:5} {name:6} {res:>7}  {secs:5.0f} s  {desc}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
