"""Prueba de extremo a extremo (Fase 5). Un recorrido completo, como lo haría una persona, abriendo web/index.html por file://:

  1. abrir sin servidor, sin errores en consola;
  2. alternar Mapa 2D ↔ Relieve 3D (antes y durante el recorrido);
  3. aceptar la misión y la ruta de EV1 y caminar hasta la cima;
  4. atender una alerta crítica de pendiente (desvío si hay uno corto, si no seguir con precaución);
  5. registrar un hallazgo y comprobar que EV2 y EV3 lo reciben sin perder su viaje separado;
  6. llegar a la cima: el resumen muestra dosis EVA, hallazgo y alertas.

Requisitos: pip install playwright (usa el Edge/Chrome instalado).  Uso: python tests/web_e2e.py [carpeta_capturas]
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

INDEX = (Path(__file__).resolve().parent.parent / "web" / "index.html").as_uri()
ERRORS: list[str] = []
CHECKS: list[tuple[str, bool, str]] = []
IGNORE = ("GPU stall", "GL Driver")


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(("OK   " if ok else "FALLA"), name, detail)


def modal_text(pg) -> str:
    return pg.evaluate("() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.innerText : '' }")


def set_view(pg, view: str) -> None:
    pg.evaluate("v => document.querySelector('[role=radio][data-view=\"' + v + '\"]').click()", view)
    pg.wait_for_timeout(1200)


def terrain_brightness(pg) -> float:
    """Luminancia media (0-255) de la zona central de la pantalla: un relieve 3D con textura negra da valores muy bajos."""
    import base64
    png = base64.b64encode(pg.screenshot(clip={"x": 560, "y": 260, "width": 700, "height": 560})).decode()
    return pg.evaluate("""b64 => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; res(s / (d.length / 4)); }; im.src = 'data:image/png;base64,' + b64; })""", png)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    shots = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true'); localStorage.removeItem('mr_shared'); localStorage.removeItem('mr_eva');")
        pg = ctx.new_page()
        pg.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
        pg.on("response", lambda r: ERRORS.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)

        # --- 1. abrir por file://
        pg.goto(INDEX)
        pg.wait_for_selector("#modal:not([hidden]) [data-a]", timeout=8000)
        check("abre por file:// (sin servidor)", pg.url.startswith("file:"), pg.url[:40])
        check("modo local: sin backend", pg.evaluate("() => MR.API.online") is False)
        check("briefing con soles estimados", "soles" in modal_text(pg))
        check("tres astronautas disponibles", pg.evaluate("() => document.querySelectorAll('.crew button').length") == 3)
        if shots:
            pg.screenshot(path=str(shots / "e2e_1_briefing.png"))

        # --- 2. 2D ↔ 3D (con el briefing abierto: los botones de vista se accionan por script)
        check("arranca en Mapa 2D", pg.evaluate("() => document.querySelector('[role=radio][data-view=\"2d\"]').getAttribute('aria-checked')") == "true")
        set_view(pg, "3d")
        ok3d = pg.evaluate("() => !!(MR.Scene3D && MR.Scene3D.ready) && !!document.querySelector('canvas')")
        check("Relieve 3D se inicia (WebGL)", ok3d)
        pg.evaluate("() => document.querySelector('#modal [data-n]') && 0")
        pg.wait_for_timeout(1500)
        lum = terrain_brightness(pg)
        check("el terreno 3D tiene textura (no sale negro por file://)", lum > 45, f"luminancia media {lum:.0f}/255")
        if shots and ok3d:
            pg.screenshot(path=str(shots / "e2e_2_3d.png"))
        set_view(pg, "2d")
        check("vuelve a Mapa 2D", pg.evaluate("() => document.querySelector('[role=radio][data-view=\"2d\"]').getAttribute('aria-checked')") == "true")

        # --- 3. misión y ruta de EV1
        pg.click("#modal [data-a]")
        pg.wait_for_selector("#dockPlan [data-acc]", timeout=5000)
        est = pg.evaluate("() => MR.eva.plan(MR.state().baseRoute)")
        pg.click("#dockPlan [data-acc]")
        check("recorrido de EV1 iniciado", pg.evaluate("() => MR.state().mode") == "walk")
        pg.evaluate("() => document.querySelector('.speed [data-speed=\"50\"]').click()")
        pg.evaluate("() => { MR.cfg.radThr = 1e6; }")  # la radiación se prueba aparte; aquí manda la alerta de pendiente

        # --- 4. caminar; atender la alerta crítica; hallazgo compartido a mitad de camino; 3D durante el recorrido
        state = {"alert": None, "finding": False, "view3d": False}
        waited = 0
        pg.evaluate("() => document.getElementById('btnPlay').click()")
        while waited < 170000 and pg.evaluate("() => MR.state().mode") == "walk":
            mt = modal_text(pg)
            if "Pendiente fuerte" in mt:
                state["alert"] = "desvío" if pg.query_selector("#modal [data-d]:not([disabled])") else "seguir"
                if shots and not (shots / "e2e_3_alerta.png").exists():
                    pg.screenshot(path=str(shots / "e2e_3_alerta.png"))
                pg.click("#modal [data-d]" if state["alert"] == "desvío" else "#modal [data-s]")
                pg.wait_for_timeout(300)
            elif mt:
                for sel in ("[data-ignore]", "[data-s]", "[data-p]"):
                    if pg.query_selector("#modal " + sel):
                        pg.click("#modal " + sel)
                        break
            elif pg.evaluate("() => !document.getElementById('stageCard').hidden"):
                pg.evaluate("() => document.querySelector('#stageCard .btn.primary').click()")
            elif not pg.evaluate("() => MR.state().playing"):
                pg.evaluate("() => document.getElementById('btnPlay').click()")
            km = pg.evaluate("() => MR.state().km")
            if not state["view3d"] and km > 8:  # alternar 3D durante el recorrido
                state["view3d"] = True
                set_view(pg, "3d")
                state["view3d_ok"] = pg.evaluate("() => !!(MR.Scene3D && MR.Scene3D.ready)")
                set_view(pg, "2d")
            if not state["finding"] and km > 20 and pg.evaluate("() => MR.state().playing"):
                state["finding"] = True
                pg.evaluate("() => document.getElementById('btnPlay').click()")  # pausa
                pg.evaluate("() => document.getElementById('btnReport').click()")
                pg.wait_for_selector("#miniCard:not([hidden]) .typepick button", timeout=5000)
                pg.click("#miniCard .typepick button[data-k=mineral]")
                pg.fill("#miniCard textarea", "sulfato en afloramiento")
                pg.click("#miniCard [data-s]")
                pg.wait_for_timeout(400)
                # EV2 y EV3 lo reciben y conservan su viaje separado
                got = {}
                for c in ("ev2", "ev3"):
                    pg.evaluate("c => document.querySelector('.crew button[data-id=' + c + ']').click()", c)
                    pg.wait_for_timeout(500)
                    pg.evaluate("() => { const b = document.querySelector('#modal:not([hidden]) [data-n]'); b && b.click(); }")
                    got[c] = pg.evaluate("() => ({ peers: MR.state().log.filter(m => m.from === 'peer' && m.text.includes('sulfato')).length, mode: MR.state().mode, km: MR.state().km, findings: MR.state().findings.length, zones: document.querySelectorAll('#vector .r-zone').length })")
                state["peers"] = got
                pg.evaluate("() => document.querySelector('.crew button[data-id=ev1]').click()")
                pg.wait_for_timeout(500)
                pg.evaluate("() => document.getElementById('btnPlay').click()")
            pg.wait_for_timeout(120)
            waited += 120

        done = pg.evaluate("() => ({ mode: MR.state().mode, km: MR.state().km, sols: Math.floor(MR.state().simMin / 1440) + 1, alerts: MR.state().alerts, detours: MR.state().detours, dose: MR.state().rad.total, findings: MR.state().findings.length })")
        check("recorrido completo hasta la cima", done["mode"] == "done", f"{done['km']:.1f} km en {done['sols']} soles")
        check("atendió una alerta crítica de pendiente", state["alert"] is not None and done["alerts"] >= 1, f"{state['alert']} · {done['alerts']} alertas · {done['detours']} desvíos")
        check("alternó a 3D durante el recorrido", state.get("view3d_ok") is True)
        check("el hallazgo se registró en el viaje de EV1", state["finding"] and done["findings"] == 1)
        peers = state.get("peers", {})
        check("EV2 y EV3 recibieron el hallazgo", all(v["peers"] == 1 for v in peers.values()) and len(peers) == 2, str(peers))
        check("sus viajes siguen separados (sin hallazgos propios, km 0, sin ruta)", all(v["findings"] == 0 and v["km"] == 0 and v["mode"] == "base" for v in peers.values()))
        check("EV2 y EV3 veían la zona en el mapa", all(v["zones"] == 1 for v in peers.values()))
        check("los soles simulados coinciden con la estimación", abs(done["sols"] - est["solsCeil"]) <= 1, f"simulados {done['sols']} · estimados {est['solsCeil']}")
        check("la dosis EVA acumulada es positiva", done["dose"] > 0, f"{done['dose']:.2f} mSv")

        # --- 5. resumen
        pg.wait_for_selector("#summary:not([hidden])", timeout=8000)
        summ = " ".join(pg.inner_text("#summary").split())
        check("el resumen dice «Misión completada»", "Misión completada" in summ)
        check("el resumen muestra la dosis EVA (modelo simplificado)", "dosis EVA" in summ and "simplificado" in summ.lower())
        check("el resumen cuenta el hallazgo y las alertas", "hallazgos" in summ and "alertas atendidas" in summ)
        if shots:
            pg.screenshot(path=str(shots / "e2e_4_resumen.png"))

        errs = [e for e in ERRORS if not any(i in e for i in IGNORE)]
        check("sin errores en consola durante todo el recorrido", not errs, "; ".join(errs)[:500])
        browser.close()

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} comprobaciones correctas")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
