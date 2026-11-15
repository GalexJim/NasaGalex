"""Empaqueta los mapas base como data: URI en un script (web/data/basemaps_data.js).

Por qué: al abrir index.html con doble clic (file://) el navegador marca como "contaminada" cualquier imagen
cargada desde un archivo y WebGL se niega a usarla como textura ("Tainted canvases may not be loaded"):
el relieve 3D quedaba negro. Una imagen que viene de un data: URI sí se puede usar. El script se carga
bajo demanda la primera vez que se abre el relieve 3D.

Uso: python scripts/export_basemaps.py
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "web" / "assets"
NAMES = ["basemap_relief", "basemap_color", "basemap_jezero_relief", "basemap_jezero_color"]


def main() -> None:
    data = {n: "data:image/jpeg;base64," + base64.b64encode((ASSETS / f"{n}.jpg").read_bytes()).decode("ascii") for n in NAMES}
    out = ROOT / "web" / "data" / "basemaps_data.js"
    out.write_text("window.MARS_BASEMAPS=" + json.dumps(data) + ";\n", encoding="utf-8")
    print(f"Escrito {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {len(NAMES)} mapas)")


if __name__ == "__main__":
    main()
