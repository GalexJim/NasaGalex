"""Incertidumbre del bosque aleatorio de traversabilidad: desacuerdo entre árboles.

Para cada celda se pregunta a cada uno de los 300 árboles por la probabilidad de "terreno transitable"
y se mide cuánto se contradicen (desviación estándar). Si todos coinciden, la confianza es alta; si
unos dicen "fácil" y otros "difícil", es baja.

IMPORTANTE: el desacuerdo entre árboles NO mide toda la incertidumbre. Fuera del corredor de
entrenamiento los árboles pueden coincidir y estar equivocados juntos. Por eso el script también
calcula qué parte del terreno cae fuera del rango de variables que el modelo vio al entrenarse.

Requiere data/processed/layers.npz (python scripts/build_layers.py) y models/terrain_model.joblib.
Genera:
  web/data/uncertainty_data.js  -> window.MARS_EXTRA (capa "confidence" a 300 × 300, se carga como script)
  models/uncertainty_summary.json -> cifras para docs/ y para el dashboard
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from export_web import GRID, b64, block_mean, q8  # noqa: E402
from marsroute.layers import load_layers  # noqa: E402
from marsroute.model import FEATURES, build_dataset, feature_matrix, load_model  # noqa: E402

STD_CAP = 0.5  # una desviación de 0,5 es el máximo posible entre probabilidades de 0 a 1


def tree_spread(model, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Media y desviación estándar de las probabilidades por árbol, sin guardar los 300 mapas."""
    n = len(model.estimators_)
    s = np.zeros(X.shape[0], dtype="float64")
    s2 = np.zeros(X.shape[0], dtype="float64")
    for tree in model.estimators_:
        p = tree.predict_proba(X)[:, 1].astype("float64")
        s += p
        s2 += p * p
    mean = s / n
    return mean, np.sqrt(np.maximum(s2 / n - mean * mean, 0.0))


def main() -> None:
    config = yaml.safe_load((ROOT / "config" / "mission.yaml").read_text(encoding="utf-8"))
    layers = load_layers(ROOT / "data" / "processed" / "layers.npz")
    model = load_model(ROOT / "models")
    shape = layers["dem"].shape
    X = feature_matrix(layers).reshape(-1, len(FEATURES))

    mean, std = tree_spread(model, X)
    ref = model.predict_proba(X)[:, 1]
    assert np.allclose(mean, ref, atol=1e-4), "la media por árbol no coincide con predict_proba"
    mean, std = mean.reshape(shape), std.reshape(shape)
    confidence = 1.0 - np.clip(std / STD_CAP, 0.0, 1.0)

    # ¿qué parte del terreno queda fuera de lo que vio el modelo? (rango de cada variable en el entrenamiento)
    rows, cols, _labels, progress = build_dataset(
        layers, config["model"]["positive_buffer_m"], config["model"]["negative_buffer_m"],
        config["model"].get("hazard_fraction", 0.7), config["model"].get("seed", 7))
    train = feature_matrix(layers)[rows, cols][progress < 0.7]
    lo, hi = train.min(axis=0), train.max(axis=0)
    feats = feature_matrix(layers)
    outside_any = np.zeros(shape, dtype=bool)
    outside_by_feature = {}
    for i, name in enumerate(FEATURES):
        out = (feats[..., i] < lo[i]) | (feats[..., i] > hi[i])
        outside_by_feature[name] = float(out.mean())
        outside_any |= out

    dist_km = layers["traverse_distance"]
    bands = {"a menos de 1 km del recorrido": dist_km <= 1.0, "de 1 a 10 km": (dist_km > 1.0) & (dist_km <= 10.0),
             "a más de 10 km": dist_km > 10.0}
    by_band = {k: {"celdas_pct": float(100 * m.mean()), "desv_arboles_media": float(std[m].mean()),
                   "confianza_media": float(confidence[m].mean()), "fuera_de_rango_pct": float(100 * outside_any[m].mean()),
                   "transitabilidad_media": float(mean[m].mean())} for k, m in bands.items() if m.any()}

    # sobre las rutas exportadas a la web (puntos lon/lat → celda de 44 m)
    bbox = config["bbox"]
    routes_file = ROOT / "web" / "data" / "routes.json"
    route_stats = {}
    if routes_file.exists():
        routes = json.loads(routes_file.read_text(encoding="utf-8"))
        for name, r in routes.items():
            pts = r["points"] if isinstance(r, dict) and "points" in r else r
            if not isinstance(pts, list) or not pts:
                continue
            ci = np.clip(((np.array([p[0] for p in pts]) - bbox[0]) / (bbox[2] - bbox[0]) * shape[1]).astype(int), 0, shape[1] - 1)
            ri = np.clip(((bbox[3] - np.array([p[1] for p in pts])) / (bbox[3] - bbox[1]) * shape[0]).astype(int), 0, shape[0] - 1)
            route_stats[name] = {"confianza_media": float(confidence[ri, ci].mean()), "fuera_de_rango_pct": float(100 * outside_any[ri, ci].mean()),
                                 "puntos": len(pts)}

    summary = {
        "arboles": len(model.estimators_),
        "desv_arboles": {"media": float(std.mean()), "p50": float(np.percentile(std, 50)), "p90": float(np.percentile(std, 90)),
                         "max": float(std.max())},
        "celdas_confianza_baja_pct": float(100 * (confidence < 0.5).mean()),
        "fuera_de_rango_entrenamiento_pct": float(100 * outside_any.mean()),
        "fuera_de_rango_por_variable_pct": {k: 100 * v for k, v in outside_by_feature.items()},
        "rango_entrenamiento": {n: [float(lo[i]), float(hi[i])] for i, n in enumerate(FEATURES)},
        "por_distancia_al_recorrido": by_band, "rutas": route_stats,
        "nota": "El desacuerdo entre árboles no cubre el error por extrapolación fuera del corredor de entrenamiento.",
    }
    (ROOT / "models" / "uncertainty_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    conf_s = block_mean(confidence.astype("float32"), GRID)
    extra = {
        "confidence": {"b64": b64(q8(conf_s, 0, 1)), "dtype": "u8", "min": 0, "max": 1, "unit": "índice"},
        "summary": {k: summary[k] for k in ("arboles", "desv_arboles", "celdas_confianza_baja_pct", "fuera_de_rango_entrenamiento_pct",
                                              "por_distancia_al_recorrido", "rutas")},
    }
    out = ROOT / "web" / "data" / "uncertainty_data.js"
    out.write_text("window.MARS_EXTRA=" + json.dumps(extra, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nEscrito {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
