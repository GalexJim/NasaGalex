"""Servidor del prototipo — Ruta segura a Mount Sharp.

Sirve la página web (carpeta web/) y una API JSON pequeña:

  GET  /api/health                 estado del servidor
  GET  /api/objetivos              objetivos fijos (almacén de documentos)
  GET  /api/hallazgos?crew=ev1     hallazgos de un explorador (SQLite)
  GET  /api/bitacora?crew=ev1      mensajes de la bitácora (SQLite)
  GET  /api/telemetria?crew=ev1    lecturas de telemetría (almacén de documentos)
  POST /api/hallazgos              guarda un hallazgo
  POST /api/bitacora               guarda un mensaje
  POST /api/misiones               guarda/actualiza una misión
  POST /api/telemetria             guarda una lectura de telemetría
  POST /api/route                  calcula una ruta A* en la grilla completa (44 m)

Uso:
  python backend/server.py            -> http://127.0.0.1:8000
  python backend/server.py --port 9000 --host 0.0.0.0

Solo usa la biblioteca estándar de Python (+ numpy/scipy para /api/route).
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import re
import sqlite3
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DATA = ROOT / "backend" / "data"
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "src"))

from docstore import DocStore  # noqa: E402

MAX_BODY = 64 * 1024
CREW = {"ev1", "ev2", "ev3"}
DB_LOCK = threading.Lock()

# ---------------------------------------------------------------- bases de datos
DATA.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA / "mars_route.sqlite"
db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript((ROOT / "backend" / "schema.sql").read_text(encoding="utf-8"))
docs = DocStore(DATA / "docstore")

# carga inicial del almacén de documentos con los datos exportados
_obj = WEB / "data" / "objetivos.json"
if _obj.exists() and not docs.find("objetivos", limit=1):
    docs.replace_all("objetivos", json.loads(_obj.read_text(encoding="utf-8")))


# ---------------------------------------------------------------- validación
def _num(v, lo=-1e9, hi=1e9):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise ValueError("número inválido")
    if not (lo <= f <= hi):
        raise ValueError("número fuera de rango")
    return f


def _txt(v, n=200, required=False):
    if v is None or v == "":
        if required:
            raise ValueError("campo obligatorio vacío")
        return None
    s = re.sub(r"[\x00-\x1f<>]", "", str(v)).strip()[:n]
    if required and not s:
        raise ValueError("campo obligatorio vacío")
    return s


def _crew(v):
    if v not in CREW:
        raise ValueError("explorador desconocido")
    return v


def save_hallazgo(b):
    tipo = b.get("type")
    if tipo not in ("mineral", "roca", "otro"):
        raise ValueError("tipo de hallazgo inválido")
    row = (_txt(b.get("id"), 40, True), _crew(b.get("crew")), tipo, _txt(b.get("note"), 140),
           _num(b.get("lon"), 130, 145), _num(b.get("lat"), -10, 0), _num(b.get("elev")),
           _num(b.get("simMin"), 0, 1e7), _num(b.get("km"), 0, 1000), 1 if b.get("photo") else 0)
    with DB_LOCK:
        db.execute("INSERT OR REPLACE INTO hallazgo (id, explorador, tipo, nota, lon, lat, altura_m, sol_min, km, tiene_foto)"
                   " VALUES (?,?,?,?,?,?,?,?,?,?)", row)
        db.commit()


def save_mensaje(b):
    remitente = {"explorador": "explorador", "tierra": "tierra", "sistema": "sistema"}.get(b.get("from"), "explorador")
    row = (_crew(b.get("crew")), remitente, _txt(b.get("text"), 300, True), _txt(b.get("kind"), 20),
           _num(b.get("lon"), 130, 145), _num(b.get("lat"), -10, 0), _num(b.get("t"), 0, 1e7))
    with DB_LOCK:
        db.execute("INSERT INTO mensaje (explorador, remitente, texto, tipo, lon, lat, sol_min) VALUES (?,?,?,?,?,?,?)", row)
        db.commit()


def save_mision(b):
    tipo = b.get("kind") if b.get("kind") in ("principal", "secundaria") else "secundaria"
    origen = b.get("origin") if b.get("origin") in ("asignada", "propia") else None
    row = (_crew(b.get("crew")), tipo, origen, _txt(b.get("name"), 80, True), _num(b.get("lon"), 130, 145),
           _num(b.get("lat"), -10, 0), _txt(b.get("status"), 20, True), _num(b.get("km"), 0, 1000))
    with DB_LOCK:
        db.execute("INSERT INTO mision (explorador, tipo, origen, nombre, lon, lat, estado, km) VALUES (?,?,?,?,?,?,?,?)", row)
        db.commit()


def save_telemetria(b):
    wx = b.get("wx") or {}
    doc = {"crew": _crew(b.get("crew")), "t": _num(b.get("t"), 0, 1e7), "km": _num(b.get("km"), 0, 1000),
           "lon": _num(b.get("lon"), 130, 145), "lat": _num(b.get("lat"), -10, 0), "elev": _num(b.get("elev")),
           "clima": {k: _num(wx.get(k)) for k in ("air", "ground", "uv", "rh", "p") if k in wx}}
    docs.insert("telemetria", doc)


# ---------------------------------------------------------------- rutas (grilla completa)
_planner = {}


def plan_route(b):
    import numpy as np
    import yaml
    from marsroute.layers import load_layers
    from marsroute.planner import astar, build_cost_surface, route_lonlat, simplify

    if "cost" not in _planner:
        cfg = yaml.safe_load((ROOT / "config" / "mission.yaml").read_text(encoding="utf-8"))
        layers = load_layers(ROOT / "data" / "processed" / "layers.npz")
        trav = np.load(ROOT / "outputs" / "traversability.npy")
        _planner.update(cfg=cfg, layers=layers, trav=trav)
    cfg, layers, trav = _planner["cfg"], _planner["layers"], _planner["trav"]
    user = b.get("cfg") or {}
    pc = dict(cfg["planner"])
    pc["risk_weight"] = _num(user.get("riskW", pc["risk_weight"]), 0, 20)
    pc["slope_weight"] = _num(user.get("slopeW", pc["slope_weight"]), 0, 20)
    pc["max_slope_deg"] = _num(user.get("maxSlope", pc["max_slope_deg"]), 5, 35)
    cost, blocked = build_cost_surface(trav, layers["slope"], **pc)
    stops = b.get("stops") or []
    if not (2 <= len(stops) <= 8):
        raise ValueError("se necesitan entre 2 y 8 puntos")
    w, s, e, n = cfg["bbox"]
    size = cfg["grid_size"]
    cells = []
    for lon, lat in stops:
        lon, lat = _num(lon, w, e), _num(lat, s, n)
        cells.append((min(size - 1, int((n - lat) / (n - s) * size)), min(size - 1, int((lon - w) / (e - w) * size))))
    path = []
    for a, c in zip(cells, cells[1:]):
        r = astar(cost, blocked, a, c)
        path.extend(r.cells.tolist() if not path else r.cells.tolist()[1:])
    ll = route_lonlat(simplify(np.asarray(path)), cfg["bbox"], size)
    return {"route": ll.tolist(), "cells": len(path)}


# ---------------------------------------------------------------- HTTP
SEC_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "MarsRoute/1.0"

    def log_message(self, fmt, *args):  # registro compacto
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _send(self, code, body: bytes, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if ctype.startswith("application/json") else "max-age=300")
        for k, v in SEC_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            name = url.path[5:]
            try:
                if name == "health":
                    return self._json(200, {"status": "ok", "sqlite": DB_PATH.name, "docstore": "mongodb" if docs.mongo else "jsonl"})
                if name == "objetivos":
                    return self._json(200, [{k: v for k, v in d.items() if not k.startswith("_")} for d in docs.find("objetivos")])
                crew = _crew(q.get("crew", "ev1"))
                if name == "hallazgos":
                    rows = db.execute("SELECT * FROM hallazgo WHERE explorador = ? ORDER BY creado", (crew,)).fetchall()
                    return self._json(200, [dict(r) for r in rows])
                if name == "bitacora":
                    rows = db.execute("SELECT * FROM mensaje WHERE explorador = ? ORDER BY id", (crew,)).fetchall()
                    return self._json(200, [dict(r) for r in rows])
                if name == "telemetria":
                    return self._json(200, docs.find("telemetria", {"crew": crew}, limit=1000))
            except ValueError as exc:
                return self._json(400, {"error": str(exc)})
            return self._json(404, {"error": "ruta de API desconocida"})
        # archivos estáticos (sin salir de web/)
        rel = url.path.lstrip("/") or "index.html"
        target = (WEB / rel).resolve()
        if (WEB.resolve() not in target.parents) or not target.is_file():
            return self._send(404, b"No encontrado", "text/plain; charset=utf-8")
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self._send(200, target.read_bytes(), ctype)

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"error": "cuerpo vacío o demasiado grande"})
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._json(415, {"error": "se espera JSON"})
        try:
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("se espera un objeto JSON")
            name = url.path[5:] if url.path.startswith("/api/") else ""
            handlers = {"hallazgos": save_hallazgo, "bitacora": save_mensaje, "misiones": save_mision, "telemetria": save_telemetria}
            if name in handlers:
                handlers[name](body)
                return self._json(201, {"ok": True})
            if name == "route":
                return self._json(200, plan_route(body))
            return self._json(404, {"error": "ruta de API desconocida"})
        except (ValueError, json.JSONDecodeError) as exc:
            return self._json(400, {"error": str(exc)})
        except FileNotFoundError:
            return self._json(503, {"error": "faltan capas procesadas: ejecuta scripts/build_layers.py"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"Ruta segura a Mount Sharp → http://{a.host}:{a.port}  (Ctrl+C para salir)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
