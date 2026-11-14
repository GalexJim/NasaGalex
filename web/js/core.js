/* =========================================================
   core.js — datos, geometría, A*, clima y modelo de caminata
   Todo lo que no es interfaz vive aquí.
   ========================================================= */
(function () {
  "use strict";
  const D = window.MARS_DATA;
  const MR = (window.MR = { D });
  const [W, S, E, N] = D.bbox;
  const G = D.layers.grid;              // 300 × 300
  const R_MARS_KM = 3389.5;
  const KM_PER_DEG = (Math.PI / 180) * R_MARS_KM;
  MR.G = G; MR.WORLD = 1200;

  /* ---------- decodificación de capas (base64 → arreglos) ---------- */
  function decode(layer) {
    const bin = atob(layer.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const raw = layer.dtype === "u16" ? new Uint16Array(u8.buffer) : u8;
    const top = layer.dtype === "u16" ? 65535 : 255;
    const out = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = layer.min + (raw[i] / top) * (layer.max - layer.min);
    return out;
  }
  MR.F = {};
  for (const k of Object.keys(D.layers)) if (k !== "grid") MR.F[k] = decode(D.layers[k]);

  /* ---------- geometría ---------- */
  MR.toWorld = (lon, lat) => [((lon - W) / (E - W)) * 1200, ((N - lat) / (N - S)) * 1200];
  MR.fromWorld = (x, y) => [W + (x / 1200) * (E - W), N - (y / 1200) * (N - S)];
  MR.cellOf = (lon, lat) => {
    const c = Math.min(G - 1, Math.max(0, Math.floor(((lon - W) / (E - W)) * G)));
    const r = Math.min(G - 1, Math.max(0, Math.floor(((N - lat) / (N - S)) * G)));
    return [r, c];
  };
  MR.cellCenter = (r, c) => [W + ((c + 0.5) / G) * (E - W), N - ((r + 0.5) / G) * (N - S)];
  MR.sample = (key, lon, lat) => { const [r, c] = MR.cellOf(lon, lat); return MR.F[key][r * G + c]; };
  MR.distKm = (a, b) => {
    const kx = KM_PER_DEG * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * KM_PER_DEG);
  };
  MR.inBounds = (lon, lat) => lon >= W && lon <= E && lat >= S && lat <= N;
  MR.fmt = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-/, "−"));
  MR.fmtLL = (lon, lat) => `${MR.fmt(lat, 3)}° · ${MR.fmt(lon, 3)}°`;

  /* ---------- rutas: formato [lon, lat, km, elev, slope, rough, trav] ---------- */
  MR.withKm = function (pts) {
    let km = 0;
    return pts.map((p, i) => {
      if (i) km += MR.distKm(pts[i - 1], p);
      return [p[0], p[1], km, p[3], p[4], p[5], p[6]];
    });
  };
  MR.routeStats = function (pts) {
    const n = pts.length; if (!n) return null;
    let s = 0, smax = 0, tr = 0, ro = 0, steep = 0, low = 0, gain = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i]; s += p[4]; tr += p[6]; ro += p[5]; smax = Math.max(smax, p[4]);
      if (p[4] > MR.cfg.critSlope) steep++;
      if (p[6] < MR.cfg.travThr) low++;
      if (i && p[3] > pts[i - 1][3]) gain += p[3] - pts[i - 1][3];
    }
    const len = pts[n - 1][2];
    return { length: len, meanSlope: s / n, maxSlope: smax, meanTrav: tr / n, meanRough: ro / n,
      steepFrac: steep / n, lowFrac: low / n, gain, hours: MR.estimateHours(pts),
      hazards: MR.hazardZones(pts).length, minElev: Math.min(...pts.map(p => p[3])), maxElev: Math.max(...pts.map(p => p[3])) };
  };

  /* ---------- configuración global (umbrales y pesos) ---------- */
  MR.cfg = { riskW: 4, slopeW: 3, maxSlope: 20, caution: 8, critSlope: 15, travThr: 0.25 };

  /* ---------- zonas de peligro sobre una ruta ---------- */
  MR.hazardZones = function (pts, crit = MR.cfg.critSlope) {
    const zones = []; let cur = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[4] > crit) {
        if (cur && p[2] - cur.endKm < 0.3) { cur.end = i; cur.endKm = p[2]; cur.max = Math.max(cur.max, p[4]); cur.rough = Math.max(cur.rough, p[5]); }
        else { cur = { start: i, end: i, startKm: p[2], endKm: p[2], max: p[4], rough: p[5] }; zones.push(cur); }
      }
    }
    zones.forEach((z, i) => (z.id = "hz" + i + "_" + z.startKm.toFixed(2)));
    return zones;
  };
  MR.lowTravZones = function (pts, thr = MR.cfg.travThr) {
    const zones = []; let cur = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[6] < thr) {
        if (cur && p[2] - cur.endKm < 0.4) { cur.end = i; cur.endKm = p[2]; cur.min = Math.min(cur.min, p[6]); }
        else { cur = { start: i, end: i, startKm: p[2], endKm: p[2], min: p[6] }; zones.push(cur); }
      }
    }
    return zones.filter(z => z.endKm - z.startKm > 0.15).map((z, i) => Object.assign(z, { id: "lt" + i + "_" + z.startKm.toFixed(2) }));
  };

  /* ---------- modelo de caminata (Tobler adaptado a traje EVA) ----------
     v = 6·e^(−3.5·|pendiente_firmada + 0.05|) km/h  (función de Tobler)
     × 0.55 por traje presurizado y × (1 − 0.35·(1 − facilidad de paso))   */
  MR.walkSpeed = function (grade, trav) {
    const tob = 6 * Math.exp(-3.5 * Math.abs(grade + 0.05));
    return Math.max(0.4, tob * 0.55 * (1 - 0.35 * (1 - trav)));
  };
  MR.gradeAt = function (pts, i) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = (b[2] - a[2]) * 1000;
    return d > 1 ? (b[3] - a[3]) / d : 0;
  };
  MR.estimateHours = function (pts) {
    let h = 0;
    for (let i = 1; i < pts.length; i++) {
      const dk = pts[i][2] - pts[i - 1][2];
      h += dk / MR.walkSpeed(MR.gradeAt(pts, i), pts[i][6]);
    }
    return h;
  };

  /* ---------- clima (REMS de Curiosity) ----------
     Perfil diurno real por hora solar local + corrección por altura:
     temperatura −2,5 °C/km y presión con escala de altura de 11,1 km.      */
  const REF_ELEV = -4500;
  function interp(arr, hour) {
    const n = arr.length; const x = ((hour % 24) + 24) % 24 / 24 * n;
    const i0 = Math.floor(x) % n, i1 = (i0 + 1) % n, t = x - Math.floor(x);
    return arr[i0] * (1 - t) + arr[i1] * t;
  }
  function noise(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x) - 0.5; }
  MR.weather = function (hour, elev, profile = "sol_100", seed = 0) {
    const P = D.rems[profile];
    const dz = (elev - REF_ELEV) / 1000;
    const n = noise(seed);
    return {
      air: interp(P.air_c, hour) - 2.5 * dz + n * 1.6,
      ground: interp(P.ground_c, hour) - 2.5 * dz + n * 2,
      uv: Math.max(0, interp(P.uv_w_m2, hour) * (1 + n * 0.06)),
      rh: Math.max(0, interp(P.rh_pct, hour)),
      p: interp(P.pressure_pa, hour) * Math.exp(-(elev - REF_ELEV) / 11100) + n * 3,
    };
  };

  /* ---------- A* sobre la grilla de 300 × 300 ----------
     costo = 1 + w_r·(1 − p)² + w_s·penalización_pendiente²
     Se bloquean celdas con pendiente > máxima o marcadas como bloqueadas por el backend. */
  function buildCost(o) {
    const n = G * G, cost = new Float32Array(n), blocked = new Uint8Array(n);
    const T = MR.F.traversability, SL = MR.F.slope, BL = MR.F.blocked;
    for (let i = 0; i < n; i++) {
      const risk = 1 - Math.min(1, Math.max(0, T[i]));
      const sp = Math.min(1, Math.max(0, (SL[i] - o.caution) / Math.max(o.maxSlope - o.caution, 1e-6)));
      cost[i] = 1 + o.riskW * risk * risk + o.slopeW * sp * sp;
      blocked[i] = (SL[i] > o.maxSlope || (BL[i] > 0.5 && o.maxSlope <= 20)) ? 1 : 0;
    }
    return { cost, blocked };
  }
  class Heap {
    constructor() { this.k = []; this.v = []; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
      if (n) {
        let i = 0;
        while (true) {
          let c = 2 * i + 1; if (c >= n) break;
          if (c + 1 < n && k[c + 1] < k[c]) c++;
          if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c;
        }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
    get size() { return this.k.length; }
  }
  function nearestFree(blocked, r, c) {
    if (!blocked[r * G + c]) return [r, c];
    for (let rad = 1; rad < 40; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= G || cc >= G) continue;
          if (!blocked[rr * G + cc]) return [rr, cc];
        }
    return [r, c];
  }
  const NB = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [1, 1, Math.SQRT2]];
  let cache = null, cacheKey = "";
  MR.astar = function (fromLL, toLL, opts) {
    const o = Object.assign({}, MR.cfg, opts || {});
    const key = [o.riskW, o.slopeW, o.maxSlope, o.caution].join("|");
    if (key !== cacheKey) { cache = buildCost(o); cacheKey = key; }
    const { cost, blocked } = cache;
    const [sr, sc] = nearestFree(blocked, ...MR.cellOf(fromLL[0], fromLL[1]));
    const [gr, gc] = nearestFree(blocked, ...MR.cellOf(toLL[0], toLL[1]));
    const n = G * G, best = new Float64Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const s = sr * G + sc, g = gr * G + gc, h = (r, c) => Math.hypot(r - gr, c - gc);
    best[s] = 0; const heap = new Heap(); heap.push(h(sr, sc), s);
    let expanded = 0;
    while (heap.size) {
      const i = heap.pop(); if (closed[i]) continue; closed[i] = 1; expanded++;
      if (i === g) break;
      const r = (i / G) | 0, c = i - r * G;
      for (const [dr, dc, st] of NB) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= G || cc >= G) continue;
        const j = rr * G + cc; if (closed[j] || blocked[j]) continue;
        const cand = best[i] + st * 0.5 * (cost[i] + cost[j]);
        if (cand < best[j]) { best[j] = cand; parent[j] = i; heap.push(cand + h(rr, cc), j); }
      }
    }
    if (!isFinite(best[g])) return null;
    const cells = []; for (let i = g; i !== -1; i = parent[i]) cells.push(i); cells.reverse();
    const pts = cells.map(i => {
      const r = (i / G) | 0, c = i - r * G; const [lon, lat] = MR.cellCenter(r, c);
      return [lon, lat, 0, MR.F.dem[i], MR.F.slope[i], MR.F.roughness[i], MR.F.traversability[i]];
    });
    pts[0][0] = fromLL[0]; pts[0][1] = fromLL[1];
    const out = MR.withKm(smooth(pts));
    out.expanded = expanded; out.cost = best[g];
    return out;
  };
  // suavizado ligero de la polilínea (media móvil de 3) para que no se vea escalonada
  function smooth(pts) {
    if (pts.length < 4) return pts;
    return pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return p;
      const a = pts[i - 1], b = pts[i + 1];
      return [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4, 0, p[3], p[4], p[5], p[6]];
    });
  }
  // une varios tramos A* consecutivos
  MR.chain = function (stops, opts) {
    let all = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const seg = MR.astar(stops[i], stops[i + 1], opts); if (!seg) return null;
      all = all.concat(i ? seg.slice(1) : seg);
    }
    return MR.withKm(all);
  };
  // densifica una polilínea lon/lat (cada ~150 m) y le agrega los atributos del terreno
  MR.densify = function (lls, stepKm = 0.15) {
    const out = [];
    for (let i = 0; i < lls.length - 1; i++) {
      const a = lls[i], b = lls[i + 1], n = Math.max(1, Math.ceil(MR.distKm(a, b) / stepKm));
      for (let k = 0; k < n; k++) {
        const lon = a[0] + (b[0] - a[0]) * (k / n), lat = a[1] + (b[1] - a[1]) * (k / n);
        out.push([lon, lat, 0, MR.sample("dem", lon, lat), MR.sample("slope", lon, lat), MR.sample("roughness", lon, lat), MR.sample("traversability", lon, lat)]);
      }
    }
    const l = lls[lls.length - 1];
    out.push([l[0], l[1], 0, MR.sample("dem", l[0], l[1]), MR.sample("slope", l[0], l[1]), MR.sample("roughness", l[0], l[1]), MR.sample("traversability", l[0], l[1])]);
    return MR.withKm(out);
  };
  // índice del punto de la ruta más cercano a un lon/lat (desde un índice mínimo)
  MR.nearestIdx = function (pts, ll, from = 0) {
    let bi = from, bd = Infinity;
    for (let i = from; i < pts.length; i++) { const d = MR.distKm(pts[i], ll); if (d < bd) { bd = d; bi = i; } }
    return { i: bi, d: bd };
  };
  MR.distToRoute = function (pts, ll) {
    let bd = Infinity; for (let i = 0; i < pts.length; i += 3) bd = Math.min(bd, MR.distKm(pts[i], ll)); return bd;
  };

  /* ---------- paletas de color para capas ---------- */
  function ramp(stops) {
    return t => {
      t = Math.min(1, Math.max(0, t));
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0] || 1);
        return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
      }
      const l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
    };
  }
  MR.LAYERS = [
    { key: "traversability", name: "Facilidad de paso", sub: "Predicción del modelo (0–1)", lo: "Difícil", hi: "Fácil",
      norm: v => v, ramp: ramp([[0, 196, 40, 40], [0.45, 240, 178, 60], [1, 18, 140, 80]]),
      src: "Bosque aleatorio entrenado con el recorrido real de Curiosity. Variables: pendiente, rugosidad, textura óptica, gradiente y térmico." },
    { key: "hazard", name: "Zonas no recomendadas", sub: "Pendiente alta o paso difícil", lo: "", hi: "Evitar",
      src: "Celdas con pendiente sobre el umbral crítico o facilidad de paso bajo el umbral de aviso. Ajustable en Ruta → Umbrales." },
    { key: "slope", name: "Pendiente", sub: "Grados, del DEM MOLA/HRSC", lo: "0°", hi: "30°+",
      norm: v => v / 30, ramp: ramp([[0, 255, 247, 220], [0.3, 250, 200, 90], [0.6, 220, 90, 40], [1, 120, 10, 30]]),
      src: "Derivada del modelo de elevación MOLA/HRSC (200 m) remuestreado a 44 m." },
    { key: "roughness", name: "Rugosidad", sub: "Desv. estándar local de la altura", lo: "Lisa", hi: "Rugosa",
      norm: v => v / 40, ramp: ramp([[0, 240, 240, 250], [0.5, 140, 120, 200], [1, 50, 20, 100]]),
      src: "Desviación estándar de la elevación en ventanas de 7 × 7 celdas." },
    { key: "thermal", name: "Térmico diurno", sub: "THEMIS IR (relativo)", lo: "Frío", hi: "Cálido",
      norm: v => v / 255, ramp: ramp([[0, 10, 10, 40], [0.35, 120, 30, 110], [0.7, 240, 110, 40], [1, 255, 240, 160]]),
      src: "Mosaico THEMIS infrarrojo diurno de 100 m (ASU JMARS). Ayuda a distinguir roca expuesta de polvo." },
    { key: "color_index", name: "Índice de color", sub: "Viking MDIM (rojo − azul)", lo: "Azulado", hi: "Rojizo",
      norm: v => (v - D.layers.color_index.min) / (D.layers.color_index.max - D.layers.color_index.min),
      ramp: ramp([[0, 40, 90, 170], [0.5, 235, 235, 235], [1, 190, 50, 30]]),
      src: "Mosaico Viking MDIM 2.1 a color. Las anomalías señalan cambios de composición del suelo." },
    { key: "none", name: "Sin capa", sub: "Solo mapa base", src: "" },
  ];
  MR.layerRGBA = function (key) {
    const img = new ImageData(G, G);
    const L = MR.LAYERS.find(l => l.key === key);
    for (let i = 0; i < G * G; i++) {
      let rgb, a = 255;
      if (key === "hazard") {
        const bad = MR.F.slope[i] > MR.cfg.critSlope, low = MR.F.traversability[i] < MR.cfg.travThr, blk = MR.F.blocked[i] > 0.5;
        if (blk) rgb = [120, 0, 20];
        else if (bad) rgb = [196, 40, 40];
        else if (low) { rgb = [240, 150, 40]; a = 200; }
        else { rgb = [0, 0, 0]; a = 0; }
      } else rgb = L.ramp(L.norm(MR.F[key][i]));
      img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = a;
    }
    return img;
  };
  MR.cssRamp = function (L) {
    if (!L.ramp) return "";
    const stops = [0, 0.25, 0.5, 0.75, 1].map(t => { const c = L.ramp(t); return `rgb(${c.map(Math.round).join(",")}) ${t * 100}%`; });
    return `linear-gradient(90deg, ${stops.join(",")})`;
  };

  /* ---------- curvas de nivel (marching squares) ---------- */
  MR.contours = function (step = 500) {
    const Z = MR.F.dem, segs = [];
    const lo = Math.ceil(D.layers.dem.min / step) * step;
    const sc = 1200 / G;
    for (let lv = lo; lv < D.layers.dem.max; lv += step) {
      const list = [];
      for (let r = 0; r < G - 1; r++) for (let c = 0; c < G - 1; c++) {
        const a = Z[r * G + c], b = Z[r * G + c + 1], cc = Z[(r + 1) * G + c + 1], d = Z[(r + 1) * G + c];
        const idx = (a > lv) * 8 + (b > lv) * 4 + (cc > lv) * 2 + (d > lv);
        if (idx === 0 || idx === 15) continue;
        const e = [];
        const it = (v1, v2) => (lv - v1) / (v2 - v1);
        if ((a > lv) !== (b > lv)) e.push([c + it(a, b), r]);
        if ((b > lv) !== (cc > lv)) e.push([c + 1, r + it(b, cc)]);
        if ((d > lv) !== (cc > lv)) e.push([c + it(d, cc), r + 1]);
        if ((a > lv) !== (d > lv)) e.push([c, r + it(a, d)]);
        if (e.length >= 2) list.push([(e[0][0] + .5) * sc, (e[0][1] + .5) * sc, (e[1][0] + .5) * sc, (e[1][1] + .5) * sc]);
        if (e.length === 4) list.push([(e[2][0] + .5) * sc, (e[2][1] + .5) * sc, (e[3][0] + .5) * sc, (e[3][1] + .5) * sc]);
      }
      segs.push({ level: lv, list });
    }
    return segs;
  };

  /* ---------- utilidades ---------- */
  MR.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  MR.clean = (s, max = 140) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
  MR.solTime = function (min) {
    const sol = Math.floor(min / 1440) + 1, m = ((min % 1440) + 1440) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(Math.floor(m % 60)).padStart(2, "0");
    return { sol, hour: m / 60, label: `Sol ${sol} · ${hh}:${mm}`, hm: `${hh}:${mm}` };
  };
  MR.store = {
    get(k, d) { try { const v = localStorage.getItem("mr_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("mr_" + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
})();
