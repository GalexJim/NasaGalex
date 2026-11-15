"""Prueba de navegador de la Fase 2 (confianza del modelo y limitaciones). Abre web/index.html por file://.

Requisitos: pip install playwright (usa el Edge/Chrome instalado).  Uso: python tests/web_fase2.py [captura.png]
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

INDEX = (Path(__file__).resolve().parent.parent / "web" / "index.html").as_uri()
ERRORS: list[str] = []
CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(("OK   " if ok else "FALLA"), name, detail)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    shot = sys.argv[1] if len(sys.argv) > 1 else None
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true')")
        pg = ctx.new_page()
        pg.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
        pg.goto(INDEX + "?modal=none")
        pg.wait_for_timeout(1200)

        info = pg.evaluate("() => { const f = MR.F.confidence; if (!f) return null; let lo = 9, hi = -9; for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; } return { n: f.length, lo, hi }; }")
        check("capa de confianza cargada como script (file://)", info and info["n"] == 300 * 300, str(info))
        check("valores de confianza entre 0 y 1", info and -0.01 <= info["lo"] and info["hi"] <= 1.01)

        pg.evaluate("() => document.querySelector('.layer-opt[data-key=confidence]').click()")
        check("capa Confianza seleccionable", pg.evaluate("() => document.querySelector('.layer-opt[data-key=confidence]').getAttribute('aria-checked') === 'true'"))
        check("leyenda Baja/Alta", "Baja" in pg.inner_text("#legend") and "Alta" in pg.inner_text("#legend"))

        # panel del modelo: confianza + limitaciones
        pg.evaluate("() => { document.getElementById('btnConditions').click(); }")
        pg.click(".dash-tab-btn[data-tab=mod]")
        pg.wait_for_timeout(300)
        txt = pg.inner_text("#dashBody")
        check("sección «Limitaciones y supuestos»", "Limitaciones y supuestos" in txt)
        check("cada limitación indica su origen (fuente/dato/supuesto)", all(w in txt for w in ("SUPUESTO", "FUENTE · Bennett 2023", "DATO DEL REPO")))
        check("menciona el rover frente al astronauta", "El rover no camina como un astronauta" in txt)
        check("tarjeta de confianza con advertencia", "Confianza del modelo" in txt and "no significa que acierten" in txt)
        if shot:
            pg.screenshot(path=shot)

        # tabla de rutas con la confianza media
        pg.click(".dash-tab-btn[data-tab=ter]")
        pg.wait_for_timeout(200)
        check("comparación de rutas incluye confianza media", "Confianza del modelo (media)" in pg.inner_text("#dashBody"))

        # botón "Ver en el mapa" activa la capa
        pg.click(".dash-tab-btn[data-tab=mod]")
        pg.evaluate("() => { document.querySelector('.layer-opt[data-key=none]').click(); }")
        pg.click("#btnConfLayer")
        pg.wait_for_timeout(300)
        check("«Ver en el mapa» activa la capa", pg.evaluate("() => document.querySelector('.layer-opt[data-key=confidence]').getAttribute('aria-checked') === 'true'"))

        # Jezero: la capa no existe allí → marcada «solo Gale»
        pg.evaluate("() => { const s = document.getElementById('regionSelect'); s.value = 'jezero'; s.dispatchEvent(new Event('change', { bubbles: true })); }")
        pg.wait_for_timeout(500)
        na = pg.evaluate("() => document.querySelector('.layer-opt[data-key=confidence]').classList.contains('layer-na')")
        check("en Jezero la capa figura como solo Gale", na)

        errs = [e for e in ERRORS if not any(i in e for i in ("WebGL", "GPU stall", "GL Driver"))]
        check("sin errores en consola", not errs, "; ".join(errs)[:400])
        browser.close()

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} comprobaciones correctas")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
