"""Prueba de navegador de la Fase 1 (radiación). Abre web/index.html por file://, sin servidor.

Requisitos (fuera de requirements.txt, solo para esta prueba):
    pip install playwright        # usa el Edge/Chrome instalado: no descarga navegadores
Uso:
    python tests/web_fase1.py
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


def visible(pg, sel: str) -> bool:
    return pg.evaluate("s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null }", sel)


def drain(pg, stop_on_radiation=True) -> str | None:
    """Atiende los avisos que no son de radiación para que la simulación siga. Devuelve 'rad' si aparece la alerta."""
    modal_text = pg.evaluate("() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.innerText : '' }")
    if modal_text:
        if "radiación" in modal_text.lower() and "Alerta crítica" in modal_text:
            return "rad" if stop_on_radiation else None
        for sel in ("[data-ignore]", "[data-s]"):  # tormenta: mantener rumbo · pendiente: seguir con precaución
            if pg.query_selector("#modal " + sel):
                pg.click("#modal " + sel)
                return None
        return None
    if visible(pg, "#stageCard"):
        pg.evaluate("() => { const b = document.querySelector('#stageCard .btn.primary'); b && b.click() }")
    return None


def run_until(pg, cond_js: str, timeout_ms=60000) -> bool:
    waited = 0
    while waited < timeout_ms:
        if pg.evaluate(cond_js):
            return True
        drain(pg)
        pg.wait_for_timeout(150)
        waited += 150
    return False


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows usa cp1252 por defecto
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true'); localStorage.removeItem('mr_radThr');")
        pg = ctx.new_page()
        pg.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
        pg.goto(INDEX)
        pg.wait_for_selector("#modal:not([hidden]) [data-a]", timeout=8000)

        # --- capa Radiación en el selector
        pg.evaluate("() => document.querySelector('.layer-opt[data-key=radiation]').click()")
        check("capa Radiación seleccionable", pg.evaluate("() => document.querySelector('.layer-opt[data-key=radiation]').getAttribute('aria-checked') === 'true'"))
        check("leyenda de radiación con aviso de modelo simplificado", "SIMPLIFICADO" in pg.inner_text("#legend"))
        rng = pg.evaluate("() => MR.radiation.range")
        check("índice de radiación en rango razonable", 0.7 < rng[0] < 1.0 < rng[1] < 1.5, str(rng))

        # --- misión: aceptar, elegir EVA a pie, aceptar ruta
        pg.click("#modal [data-a]")
        pg.wait_for_selector("#dockPlan [data-acc]", timeout=5000)
        pg.evaluate("() => document.querySelector('[data-mobility=astronaut]').click()")
        pg.click("#dockPlan [data-acc]")
        check("recorrido iniciado", pg.evaluate("() => MR.state().mode") == "walk")
        pg.evaluate("() => document.querySelector('.speed [data-speed=\"50\"]').click()")
        pg.evaluate("() => { MR.cfg.radThr = 1; }")  # umbral bajo para que la prueba sea corta

        # --- barra de condiciones: 5 datos, con "?" y la radiación entre ellos
        pg.evaluate("() => document.getElementById('btnPlay').click()")
        pg.wait_for_timeout(600)
        tiles = pg.evaluate("() => [...document.querySelectorAll('#live .tile')].map(t => ({k: t.querySelector('.k span').innerText, info: !!t.querySelector('.info')}))")
        check("máximo 5 datos en vivo", len(tiles) == 5, str([t['k'] for t in tiles]))
        check("cada dato con su ?", all(t["info"] for t in tiles))
        check("indicador de radiación presente", any(t["k"] == "Radiación" for t in tiles))

        # --- caminar un tramo, luego evento solar desde Condiciones → Radiación
        check("camina antes del evento", run_until(pg, "() => MR.state().km > 2.0"))
        pg.evaluate("() => { if (MR.state().playing) document.getElementById('btnPlay').click(); }")
        pg.evaluate("() => document.getElementById('btnConditions').click()")
        pg.click(".dash-tab-btn[data-tab=rad]")
        check("pestaña Radiación con rótulo de modelo simplificado", "MODELO SIMPLIFICADO" in pg.inner_text("#dashBody"))
        check("hay supuestos rotulados", pg.inner_text("#dashBody").count("SUPUESTO") >= 4)
        pg.click("#btnSpeOn")
        pg.wait_for_timeout(300)
        check("aviso de evento solar", pg.evaluate("() => MR.radiation.speActive(MR.state().rad.spe, MR.state().simMin)"))
        pg.evaluate("() => document.getElementById('btnPlay').click()")

        # --- alerta crítica (1.ª): Pausar
        check("alerta crítica de radiación", run_until(pg, "() => { const m = document.getElementById('modal'); return !m.hidden && m.innerText.includes('Alerta crítica de radiación') }", 60000))
        text = pg.inner_text("#modal")
        check("alerta ofrece pausar, abortar y volver al refugio", all(w in text for w in ("Pausar", "Abortar", "Volver al refugio")))
        check("la simulación queda en pausa", pg.evaluate("() => MR.state().playing") is False)
        dose1 = pg.evaluate("() => MR.state().rad.bySol[1] || MR.state().rad.total")
        pg.click("#modal [data-p]")
        check("Pausar cierra la alerta y mantiene la pausa", pg.evaluate("() => document.getElementById('modal').hidden && !MR.state().playing"))
        pg.evaluate("() => document.getElementById('btnPlay').click()")

        # --- 2.ª alerta (2 × umbral): Volver al refugio
        check("segunda alerta al duplicar el umbral", run_until(pg, "() => { const m = document.getElementById('modal'); return !m.hidden && m.innerText.includes('Alerta crítica de radiación') }", 60000))
        dose2 = pg.evaluate("() => MR.state().rad.total")
        check("la dosis sigue acumulando", dose2 > dose1, f"{dose1:.2f} → {dose2:.2f} mSv")
        pg.click("#modal [data-b]")
        check("regreso al refugio iniciado", pg.evaluate("() => !!MR.state().returning"), pg.evaluate("() => (MR.state().returning || {}).name || ''"))
        check("llega al refugio y abre el resumen", run_until(pg, "() => !document.getElementById('summary').hidden", 120000))
        summ = pg.inner_text("#summary")
        check("resumen muestra la dosis EVA", "dosis EVA" in summ and "Regreso al refugio" in summ)

        # --- 2D → 3D sin errores
        pg.evaluate("() => document.querySelector('#summary [data-back]').click()")
        pg.evaluate("() => document.querySelector('[data-view=\"3d\"]').click()")
        pg.wait_for_timeout(1500)
        pg.evaluate("() => document.querySelector('[data-view=\"2d\"]').click()")
        pg.wait_for_timeout(300)

        ignorable = ("WebGL", "GPU stall", "GL Driver Message")
        errs = [e for e in ERRORS if not any(i in e for i in ignorable)]
        check("sin errores en consola", not errs, "; ".join(errs)[:400])
        browser.close()

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} comprobaciones correctas")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
