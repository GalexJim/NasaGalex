"""Prueba de navegador de la Fase 3 (jornada EVA configurable y soles). Abre web/index.html por file://.

Requisitos: pip install playwright (usa el Edge/Chrome instalado).  Uso: python tests/web_fase3.py [captura.png]
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
        ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true'); localStorage.removeItem('mr_eva');")
        pg = ctx.new_page()
        pg.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
        pg.goto(INDEX)
        pg.wait_for_selector("#modal:not([hidden]) [data-a]", timeout=8000)

        # --- el briefing dice cuántos soles y por qué no 3
        txt = pg.inner_text("#modal")
        check("movilidad por defecto: a pie", pg.evaluate("() => MR.state().mobility") == "astronaut")
        check("briefing muestra los soles estimados", "soles" in txt and "SUPUESTO" in txt, txt.split("\n")[0][:80])
        ev = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        check("4 a 5 soles a pie con los valores por defecto", 4 <= ev["solsCeil"] <= 5 and 38 < ev["hours"] < 46, f"{ev['hours']:.1f} h → {ev['sols']:.2f} soles")
        pg.evaluate("() => document.querySelector('.sol-box summary').click()")
        det = pg.inner_text("#modal .sol-box")
        check("explica la diferencia con 3 soles", "¿Por qué no 3 soles?" in det and "para hacerlo en 3 soles" in det.lower() and "Nelson" in det)

        # --- la estimación usa la misma velocidad que la simulación (sin rover por error)
        rover = pg.evaluate("() => MR.estimateHours(MR.state().baseRoute, 'rover')")
        check("a pie tarda mucho más que en rover", ev["hours"] > 4 * rover, f"{ev['hours']:.0f} h vs {rover:.0f} h")

        # --- parámetros configurables: pausas y reserva alargan el recorrido; la duración lo acorta en soles
        base = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        pg.evaluate("() => { MR.eva.cfg.pauseMinPerH = 15; }")
        pausa = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        check("15 min de pausa por hora alargan el recorrido un 33 %", abs(pausa["hours"] / base["hours"] - 60 / 45) < 0.01, f"{base['hours']:.1f} → {pausa['hours']:.1f} h")
        pg.evaluate("() => { MR.eva.cfg.pauseMinPerH = 0; MR.eva.cfg.reserveMin = 60; }")
        res = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        check("la reserva reduce las horas de marcha por sol", abs(res["windowH"] - 8) < 1e-9 and res["sols"] > base["sols"], f"{base['windowH']} → {res['windowH']} h/sol")
        pg.evaluate("() => { MR.eva.cfg.reserveMin = 0; MR.eva.cfg.durationH = 12; }")
        largo = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        check("una jornada de 12 h baja los soles", largo["solsCeil"] < base["solsCeil"], f"{base['solsCeil']} → {largo['solsCeil']} soles")
        pg.evaluate("() => { MR.eva.cfg.durationH = 9; }")

        # --- controles en Ruta → Jornada EVA, con persistencia
        pg.click("#modal [data-n]")  # «Ahora no»
        pg.evaluate("() => document.querySelector('[data-lptab=ruta]').click()")
        check("panel Jornada EVA rotulado como supuesto", "Jornada EVA" in pg.inner_text("[data-lpsec=ruta]") and "SUPUESTO" in pg.inner_text("[data-lpsec=ruta]"))
        pg.evaluate("() => { const e = document.getElementById('evaPause'); e.value = 10; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }")
        check("el control de pausas actualiza el resumen", "soles" in pg.inner_text("#evaSummary") and pg.evaluate("() => MR.eva.cfg.pauseMinPerH") == 10, pg.inner_text("#evaSummary"))
        check("la configuración se guarda", pg.evaluate("() => JSON.parse(localStorage.getItem('mr_eva')).pauseMinPerH") == 10)
        if shot:
            pg.screenshot(path=shot)

        # --- simulación: coincide con la estimación y respeta la reserva
        pg.evaluate("() => { MR.eva.cfg.pauseMinPerH = 0; MR.eva.cfg.reserveMin = 120; }")  # termina de caminar a las 15:00
        pg.evaluate("() => document.getElementById('btnEvaReset').click()")
        check("restaurar vuelve a los valores por defecto", pg.evaluate("() => JSON.stringify(MR.eva.cfg) === JSON.stringify(MR.eva.DEFAULTS)"))
        pg.evaluate("() => { MR.eva.cfg.reserveMin = 120; }")
        pg.evaluate("() => { const t = MR.state(); }")
        check("el fin de marcha descuenta la reserva", pg.evaluate("() => MR.eva.walkEndHour()") == 15)
        pg.evaluate("() => { MR.eva.cfg.reserveMin = 0; }")

        # --- recorrido completo a pie con jornada configurada (guardada y recargada): 08:00–15:00 con pausas de 10 min/h
        ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx2.add_init_script("localStorage.setItem('mr_tourDone', 'true'); localStorage.setItem('mr_eva', JSON.stringify({startHour: 8, durationH: 8, pauseMinPerH: 10, reserveMin: 60}));")
        pg2 = ctx2.new_page()
        pg2.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
        pg2.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
        pg2.goto(INDEX)
        pg2.wait_for_selector("#modal:not([hidden]) [data-a]", timeout=8000)
        check("la configuración guardada se recarga", pg2.evaluate("() => MR.eva.cfg.durationH") == 8 and pg2.evaluate("() => MR.eva.walkEndHour()") == 15)
        pg2.evaluate("() => { MR.cfg.radThr = 1e6; }")  # sin alertas de radiación
        pg2.click("#modal [data-a]")
        pg2.wait_for_selector("#dockPlan [data-acc]", timeout=5000)
        est = pg2.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        pg2.click("#dockPlan [data-acc]")
        pg2.evaluate("() => document.querySelector('.speed [data-speed=\"50\"]').click()")
        pg2.evaluate("() => document.getElementById('btnPlay').click()")
        outside, waited = [], 0
        while waited < 150000 and pg2.evaluate("() => MR.state().mode") == "walk":
            st = pg2.evaluate("() => ({ h: MR.state().simMin / 60 % 24, playing: MR.state().playing })")
            if st["playing"] and not (8 - 1e-6 <= st["h"] <= 15 + 0.05):
                outside.append(round(st["h"], 2))
            mt = pg2.evaluate("() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.innerText : '' }")
            if mt:
                for sel in ("[data-ignore]", "[data-s]", "[data-p]"):
                    if pg2.query_selector("#modal " + sel):
                        pg2.click("#modal " + sel)
                        break
            elif pg2.evaluate("() => !document.getElementById('stageCard').hidden"):
                pg2.evaluate("() => document.querySelector('#stageCard .btn.primary').click()")  # continuar / descansar hasta la mañana
            elif not st["playing"]:
                pg2.evaluate("() => document.getElementById('btnPlay').click()")
            pg2.wait_for_timeout(120)
            waited += 120
        done = pg2.evaluate("() => ({ mode: MR.state().mode, simMin: MR.state().simMin, sols: Math.floor(MR.state().simMin / 1440) + 1 })")
        check("el recorrido termina", done["mode"] == "done", str(done))
        check("nunca se camina fuera de la jornada (08:00–15:00)", not outside, str(outside[:5]))
        check("los soles simulados coinciden con los estimados", done["sols"] == est["solsCeil"], f"simulados {done['sols']}, estimados {est['solsCeil']} ({est['hours']:.1f} h a {est['windowH']:.0f} h por sol)")

        errs = [e for e in ERRORS if not any(i in e for i in ("GPU stall", "GL Driver"))]
        check("sin errores en consola", not errs, "; ".join(errs)[:400])
        browser.close()

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} comprobaciones correctas")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
