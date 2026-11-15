"""Prueba de navegador de la Fase 4 (avisos compartidos entre exploradores).

  A) Sin servidor (file://): dos pestañas del mismo navegador se avisan por localStorage.
  B) Con backend (python backend/server.py en una carpeta temporal): dos navegadores distintos, SQLite y JSONL.

Requisitos: pip install playwright (usa el Edge/Chrome instalado).  Uso: python tests/web_fase4.py
"""
from __future__ import annotations

import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = (ROOT / "web" / "index.html").as_uri() + "?modal=none"
ERRORS: list[str] = []
CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(("OK   " if ok else "FALLA"), name, detail)


def new_page(ctx):
    pg = ctx.new_page()
    pg.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: ERRORS.append("PAGEERROR " + str(e)))
    pg.on("response", lambda r: ERRORS.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)  # dice qué recurso falló
    return pg


def register_finding(pg, note: str) -> None:
    pg.evaluate("() => document.getElementById('btnReport').click()")
    pg.wait_for_selector("#miniCard:not([hidden]) .typepick button", timeout=5000)
    pg.click("#miniCard .typepick button[data-k=mineral]")
    pg.fill("#miniCard textarea", note)
    pg.click("#miniCard [data-s]")


def switch_crew(pg, crew: str) -> None:
    pg.evaluate("c => document.querySelector('.crew button[data-id=' + c + ']').click()", crew)
    pg.wait_for_timeout(500)
    pg.evaluate("() => { const b = document.querySelector('#modal:not([hidden]) [data-n]'); b && b.click(); }")


def peers(pg) -> list[dict]:
    return pg.evaluate("() => MR.state().log.filter(m => m.from === 'peer').map(m => ({ text: m.text, aviso: m.aviso, author: m.author }))")


def n_markers(pg) -> int:
    return pg.evaluate("() => document.querySelectorAll('.mk[data-t=aviso]').length")


def n_zones(pg) -> int:
    return pg.evaluate("() => document.querySelectorAll('#vector .r-zone').length")


def wait_for(pg, fn_js: str, timeout_ms=15000) -> bool:
    waited = 0
    while waited < timeout_ms:
        if pg.evaluate(fn_js):
            return True
        pg.wait_for_timeout(250)
        waited += 250
    return False


def scenario_a(browser) -> None:
    print("\n== A) sin servidor: localStorage entre pestañas ==")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true');")
    a = new_page(ctx)
    a.goto(INDEX)
    a.wait_for_timeout(1200)

    register_finding(a, "olivino verde")
    check("EV1 registra el hallazgo (queda en su viaje)", a.evaluate("() => MR.state().findings.length") == 1)
    lst = a.evaluate("() => MR.Shared.list.map(n => ({ k: n.kind, a: n.author, e: n.estado }))")
    check("el hallazgo se publica como aviso compartido", lst == [{"k": "hallazgo", "a": "ev1", "e": "activo"}], str(lst))
    check("queda guardado en localStorage", len(a.evaluate("() => JSON.parse(localStorage.getItem('mr_shared') || '[]')")) == 1)
    check("el autor no ve su propio aviso como zona ajena", n_markers(a) == 0 and n_zones(a) == 0)

    # EV2 (mismo navegador): mensaje, marcador, zona; su viaje sigue separado
    switch_crew(a, "ev2")
    p2 = peers(a)
    check("EV2 recibe el mensaje en su bitácora", len(p2) == 1 and "EV1" in p2[0]["text"] and "olivino verde" in p2[0]["text"], str(p2))
    check("EV2 ve el marcador del aviso en el mapa", n_markers(a) == 1)
    check("EV2 ve la zona marcada en el mapa", n_zones(a) == 1)
    check("EV2 tiene la insignia de bitácora sin leer", a.evaluate("() => { const b = document.querySelector('[data-count=bitacora]'); return !!b && !b.hidden && +b.textContent >= 1; }"))
    check("el viaje de EV2 sigue separado (sin hallazgos, km 0, modo base)", a.evaluate("() => { const t = MR.state(); return t.findings.length === 0 && t.km === 0 && t.mode === 'base'; }"))
    switch_crew(a, "ev3")
    check("EV3 también recibe el aviso", len(peers(a)) == 1 and n_markers(a) == 1)
    switch_crew(a, "ev1")
    check("EV1 no recibe su propio aviso en la bitácora", len(peers(a)) == 0)

    # segunda pestaña: carga lo ya guardado (en silencio) y recibe lo nuevo por el evento storage
    b = new_page(ctx)
    b.goto(INDEX)
    b.wait_for_timeout(1200)
    check("la carga inicial no abre banners de avisos viejos", b.evaluate("() => !document.querySelector('#banners .banner')"))
    switch_crew(b, "ev2")
    check("la 2.ª pestaña carga los avisos guardados", len(peers(b)) == 1 and n_markers(b) == 1)
    register_finding(a, "cuarzo claro")
    check("la 2.ª pestaña recibe el aviso nuevo sin recargar", wait_for(b, "() => MR.state().log.filter(m => m.from === 'peer').length === 2", 6000))
    check("y lo muestra con banner, marcador y zona", b.evaluate("() => !!document.querySelector('#banners .banner')") and n_markers(b) == 2 and n_zones(b) == 2)
    b.evaluate("() => document.querySelector('.rail-btn[data-panel=hallazgos]').click()")
    b.wait_for_timeout(400)
    panel = " ".join(b.inner_text("#spBody").split()).upper()
    check("el panel de hallazgos de EV2 lista los de otros", "HALLAZGOS DE OTROS EXPLORADORES (2)" in panel, panel[:140])

    # deshacer retira el aviso para los demás
    a.evaluate("() => { const b = document.querySelector('#toast button'); b && b.click(); }")
    check("«Deshacer» retira el aviso en la otra pestaña", wait_for(b, "() => MR.state().log.filter(m => m.from === 'peer').length === 1 && document.querySelectorAll('.mk[data-t=aviso]').length === 1", 6000))

    a.close()
    b.close()
    ctx.close()


def scenario_a2(browser) -> None:
    print("\n== A2) alertas compartidas (pendiente y radiación) ==")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("localStorage.setItem('mr_tourDone', 'true');")
    pg = new_page(ctx)
    pg.goto(INDEX.replace("?modal=none", ""))
    pg.wait_for_selector("#modal:not([hidden]) [data-a]", timeout=8000)
    pg.click("#modal [data-a]")
    pg.wait_for_selector("#dockPlan [data-acc]", timeout=5000)
    pg.click("#dockPlan [data-acc]")
    pg.evaluate("() => document.querySelector('.speed [data-speed=\"50\"]').click()")
    pg.evaluate("() => { MR.cfg.radThr = 1e6; }")
    pg.evaluate("() => document.getElementById('btnPlay').click()")
    got = False
    waited = 0
    while waited < 140000:
        mt = pg.evaluate("() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.innerText : '' }")
        if "Pendiente fuerte" in mt:
            got = True
            break
        if mt:
            for sel in ("[data-ignore]", "[data-s]"):
                if pg.query_selector("#modal " + sel):
                    pg.click("#modal " + sel)
                    break
        elif pg.evaluate("() => !document.getElementById('stageCard').hidden"):
            pg.evaluate("() => document.querySelector('#stageCard .btn.primary').click()")
        elif not pg.evaluate("() => MR.state().playing"):
            pg.evaluate("() => document.getElementById('btnPlay').click()")
        pg.wait_for_timeout(120)
        waited += 120
    check("aparece una alerta crítica de pendiente", got)
    sl = pg.evaluate("() => MR.Shared.list.filter(n => n.kind === 'alerta_pendiente').map(n => ({ a: n.author, t: n.text }))")
    check("la alerta de pendiente se publica para los demás", len(sl) == 1 and sl[0]["a"] == "ev1" and "pendiente" in sl[0]["t"], str(sl))
    pg.click("#modal [data-s]")
    pg.evaluate("() => { MR.cfg.radThr = 0.02; }")  # umbral bajo: la alerta de radiación salta enseguida
    pg.evaluate("() => { if (!MR.state().playing) document.getElementById('btnPlay').click(); }")
    got = wait_for(pg, "() => { const m = document.getElementById('modal'); return !m.hidden && m.innerText.includes('Alerta crítica de radiación') }", 60000)
    check("aparece la alerta de radiación", got)
    rl = pg.evaluate("() => MR.Shared.list.filter(n => n.kind === 'alerta_radiacion').map(n => n.author)")
    check("la alerta de radiación se publica una sola vez", rl == ["ev1"], str(rl))
    pg.click("#modal [data-p]")
    switch_crew(pg, "ev2")
    texts = [m["text"] for m in peers(pg)]
    check("EV2 recibe ambas alertas en su bitácora", any("Alerta de pendiente" in t for t in texts) and any("Alerta de radiación" in t for t in texts) and all("tu ruta pasa a" in t for t in texts), str(texts)[:300])
    check("EV2 ve dos zonas de aviso", n_zones(pg) == 2)
    ctx.close()


def server_python() -> str:
    """El servidor necesita yaml/numpy/scipy; el Python que ejecuta Playwright puede ser otro (p. ej. un venv aparte)."""
    import shutil
    for cand in (os.environ.get("MARS_SERVER_PYTHON"), sys.executable, shutil.which("python"), shutil.which("python3")):
        if cand and subprocess.run([cand, "-c", "import yaml, numpy, scipy"], capture_output=True).returncode == 0:
            return cand
    return sys.executable


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def api(base: str, path: str):
    with urllib.request.urlopen(base + path, timeout=5) as r:
        return json.loads(r.read())


def scenario_b(browser) -> None:
    print("\n== B) con backend: SQLite + JSONL, dos navegadores ==")
    tmp = tempfile.mkdtemp(prefix="mars_fase4_")
    port = free_port()
    env = dict(os.environ, MARS_DATA_DIR=tmp, PYTHONIOENCODING="utf-8")
    srv = subprocess.Popen([server_python(), str(ROOT / "backend" / "server.py"), "--port", str(port)], env=env, cwd=str(ROOT),
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(60):
            try:
                if api(base, "/api/health")["status"] == "ok":
                    break
            except Exception:
                time.sleep(0.5)
        else:
            check("el servidor arranca", False)
            return
        check("el servidor arranca con carpeta de datos temporal", True)
        url = base + "/?modal=none"
        cx = browser.new_context(viewport={"width": 1440, "height": 900})
        cy = browser.new_context(viewport={"width": 1440, "height": 900})
        for c in (cx, cy):
            c.add_init_script("localStorage.setItem('mr_tourDone', 'true');")
        x, y = new_page(cx), new_page(cy)
        x.goto(url)
        y.goto(url)
        x.wait_for_timeout(1500)
        check("ambos navegadores se conectan al backend", x.evaluate("() => MR.API.online") and y.evaluate("() => MR.API.online"))
        switch_crew(y, "ev2")
        register_finding(x, "yeso en veta")
        rows = api(base, "/api/avisos")
        check("el aviso queda en SQLite (tabla aviso)", len(rows) == 1 and rows[0]["author"] == "ev1" and rows[0]["estado"] == "activo", str(rows)[:200])
        con = sqlite3.connect(Path(tmp) / "mars_route.sqlite")
        n_db = con.execute("SELECT COUNT(*) FROM aviso WHERE autor='ev1' AND tipo='hallazgo'").fetchone()[0]
        con.close()
        check("la fila existe en el archivo SQLite", n_db == 1)
        check("el otro navegador lo recibe por sincronización (≤ 12 s)", wait_for(y, "() => MR.state().log.filter(m => m.from === 'peer').length === 1", 12000))
        check("y lo ve en su mapa", n_markers(y) == 1 and n_zones(y) == 1)
        ev = api(base, "/api/eventos")
        tipos = [e["tipo"] for e in ev]
        check("eventos JSONL: publicado y recibido", "aviso_publicado" in tipos and "aviso_recibido" in tipos, str(tipos))
        check("el evento de recepción dice quién lo recibió", any(e["tipo"] == "aviso_recibido" and e.get("crew") == "ev2" for e in ev))
        check("el JSONL existe en la carpeta de datos", (Path(tmp) / "docstore" / "eventos.jsonl").exists())

        # reenviar el mismo aviso no lo duplica
        n = rows[0]
        body = json.dumps({"id": n["id"], "author": "ev1", "kind": "hallazgo", "text": n["text"], "lon": n["lon"], "lat": n["lat"]}).encode()
        req = urllib.request.Request(base + "/api/avisos", data=body, headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=5).read()
        check("reenviar el mismo aviso no lo duplica", len(api(base, "/api/avisos")) == 1 and [e["tipo"] for e in api(base, "/api/eventos")].count("aviso_publicado") == 1)

        # un tipo inválido o un autor falso se rechazan
        bad = json.dumps({"id": "x1", "author": "ev9", "kind": "hallazgo", "text": "t", "lon": 137, "lat": -5}).encode()
        try:
            urllib.request.urlopen(urllib.request.Request(base + "/api/avisos", data=bad, headers={"Content-Type": "application/json"}, method="POST"), timeout=5)
            rejected = False
        except urllib.error.HTTPError as e:
            rejected = e.code == 400
        check("el servidor rechaza un explorador desconocido", rejected)

        # retirar: Deshacer en el navegador del autor
        x.evaluate("() => { const b = document.querySelector('#toast button'); b && b.click(); }")
        check("retirar actualiza SQLite", wait_for(x, "() => true", 100) and api(base, "/api/avisos")[0]["estado"] == "retirado")
        check("el otro navegador deja de verlo", wait_for(y, "() => MR.state().log.filter(m => m.from === 'peer').length === 0 && document.querySelectorAll('.mk[data-t=aviso]').length === 0", 12000))
        check("evento JSONL de aviso retirado", "aviso_retirado" in [e["tipo"] for e in api(base, "/api/eventos")])
        cx.close()
        cy.close()
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=5)
        except Exception:
            srv.kill()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        scenario_a(browser)
        scenario_a2(browser)
        scenario_b(browser)
        errs = [e for e in ERRORS if not any(i in e for i in ("GPU stall", "GL Driver"))]
        check("sin errores en consola", not errs, "; ".join(errs)[:400])
        browser.close()
    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} comprobaciones correctas")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
