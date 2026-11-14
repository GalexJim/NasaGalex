/* =========================================================
   map2d.js — mapa base 2D con capas, rutas y marcadores
   (zoom con rueda, arrastre, clic → menú junto al punto)
   ========================================================= */
(function () {
  "use strict";
  const MR = window.MR;
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";

  MR.ICONS = {
    meta: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
    base: '<svg viewBox="0 0 24 24"><path d="M3 20l9-14 9 14z"/></svg>',
    mineral: '<svg viewBox="0 0 24 24"><path d="M12 3l7 6-7 12-7-12z"/></svg>',
    espectral: '<svg viewBox="0 0 24 24"><path d="M4 18c3-8 5-8 8 0s5 8 8 0"/></svg>',
    ciencia: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
    referencia: '<svg viewBox="0 0 24 24"><path d="M4 18l6-6 4 4 6-8"/></svg>',
    hallazgo: '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
    secundaria: '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 6 6.5.5-5 4 1.5 6.5L12 17l-5.5 3 1.5-6.5-5-4 6.5-.5z"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  };

  const M = (MR.Map = {});
  let t = { s: 1, x: 0, y: 0 };
  let mapEl, worldEl, markersEl, svg, groups = {}, clickCb = null;
  let markerData = [], astro = null;

  M.init = function () {
    mapEl = $("map"); worldEl = $("world"); markersEl = $("markers"); svg = $("vector");
    ["crism", "trav", "short", "shorthz", "main", "done", "sec", "hz", "measure"].forEach(k => {
      groups[k] = document.createElementNS(NS, "g"); svg.appendChild(groups[k]);
    });
    // contornos y capa de análisis
    drawContours();
    // interacción
    let drag = null, moved = false;
    mapEl.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest(".mk")) return;
      drag = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }; moved = false;
      mapEl.setPointerCapture(e.pointerId);
    });
    mapEl.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; mapEl.classList.add("dragging"); MR.UI && MR.UI.closePointUI(); }
      if (moved) { t.x = drag.tx + dx; t.y = drag.ty + dy; apply(); }
    });
    mapEl.addEventListener("pointerup", e => {
      mapEl.classList.remove("dragging");
      if (drag && !moved && clickCb) {
        const r = mapEl.getBoundingClientRect();
        const wx = (e.clientX - r.left - t.x) / t.s, wy = (e.clientY - r.top - t.y) / t.s;
        if (wx >= 0 && wy >= 0 && wx <= 1200 && wy <= 1200) clickCb(MR.fromWorld(wx, wy), e.clientX - r.left, e.clientY - r.top);
      }
      drag = null;
    });
    mapEl.addEventListener("wheel", e => {
      e.preventDefault();
      const r = mapEl.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    mapEl.addEventListener("keydown", e => {
      const k = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
      if (k) { t.x += k[0]; t.y += k[1]; apply(); e.preventDefault(); }
      if (e.key === "+" || e.key === "=") M.zoom(1.3);
      if (e.key === "-") M.zoom(1 / 1.3);
    });
    window.addEventListener("resize", () => apply());
    M.fit(false);
  };
  function zoomAt(px, py, f) {
    const ns = Math.min(8, Math.max(M.minScale(), t.s * f));
    const k = ns / t.s; t.x = px - (px - t.x) * k; t.y = py - (py - t.y) * k; t.s = ns; apply();
  }
  M.minScale = () => Math.min(mapEl.clientWidth, mapEl.clientHeight) / 1200 * 0.6;
  M.zoom = f => zoomAt(mapEl.clientWidth / 2, mapEl.clientHeight / 2, f);
  M.fit = function (anim = true) {
    const w = mapEl.clientWidth, h = mapEl.clientHeight;
    const s = Math.min(w / 1200, h / 1200) * 0.96;
    tween({ s, x: (w - 1200 * s) / 2, y: (h - 1200 * s) / 2 }, anim);
  };
  M.centerOn = function (lon, lat, scale, anim = true) {
    const [wx, wy] = MR.toWorld(lon, lat), s = scale || Math.max(t.s, 1.4);
    tween({ s, x: mapEl.clientWidth / 2 - wx * s, y: mapEl.clientHeight / 2 - wy * s }, anim);
  };
  M.keepInView = function (lon, lat) {
    const [sx, sy] = M.project(lon, lat), w = mapEl.clientWidth, h = mapEl.clientHeight;
    if (sx < w * 0.25 || sx > w * 0.75 || sy < h * 0.2 || sy > h * 0.65) {
      const [wx, wy] = MR.toWorld(lon, lat);
      tween({ s: t.s, x: w / 2 - wx * t.s, y: h * 0.42 - wy * t.s }, true, 900);
    }
  };
  let tw = null;
  function tween(to, anim, dur = 600) {
    if (tw) cancelAnimationFrame(tw);
    to = clamp({ ...to });
    if (!anim || MR.reduceMotion()) { t = to; apply(); return; }
    const from = { ...t }, t0 = performance.now();
    const step = now => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      t = { s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      apply(); if (u < 1) tw = requestAnimationFrame(step);
    };
    tw = requestAnimationFrame(step);
  }
  function clamp(o) {
    const w = mapEl.clientWidth, h = mapEl.clientHeight, W = 1200 * o.s;
    o.x = W > w ? Math.min(w * 0.15, Math.max(w * 0.85 - W, o.x)) : (w - W) / 2;
    o.y = W > h ? Math.min(h * 0.15, Math.max(h * 0.85 - W, o.y)) : (h - W) / 2;
    return o;
  }
  function apply() {
    clamp(t);
    worldEl.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.s})`;
    placeMarkers();
    MR.UI && MR.UI.repositionPointUI && MR.UI.repositionPointUI();
  }
  M.project = (lon, lat) => { const [wx, wy] = MR.toWorld(lon, lat); return [t.x + wx * t.s, t.y + wy * t.s]; };
  M.centerLL = () => MR.fromWorld((mapEl.clientWidth / 2 - t.x) / t.s, (mapEl.clientHeight / 2 - t.y) / t.s);
  M.onClick = cb => (clickCb = cb);
  M.el = () => mapEl;
  M.setPicking = on => mapEl.classList.toggle("picking", !!on);

  /* ---------- mapa base y capas ---------- */
  M.setBase = function (key) { $("basemap").src = "assets/basemap_" + key + ".jpg"; };
  // la capa (300 × 300) se reescala a 1200 px con suavizado para evitar bloques
  const small = document.createElement("canvas"); small.width = small.height = MR.G;
  M.setLayer = function (key, opacity) {
    const cv = $("overlay"), ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (key && key !== "none") {
      small.getContext("2d").putImageData(MR.layerRGBA(key), 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      if ("filter" in ctx) ctx.filter = "blur(2px)";
      ctx.drawImage(small, 0, 0, cv.width, cv.height); ctx.restore();
    }
    cv.style.opacity = opacity;
  };
  function drawContours() {
    const cv = $("contours"), ctx = cv.getContext("2d");
    const segs = MR.contours(500);
    segs.forEach(({ level, list }) => {
      const major = level % 1000 === 0;
      ctx.strokeStyle = major ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.32)";
      ctx.lineWidth = major ? 1.3 : .8;
      ctx.beginPath();
      list.forEach(s => { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
      ctx.stroke();
    });
    cv.hidden = true;
  }
  M.setContours = on => ($("contours").hidden = !on);

  /* ---------- vectores ---------- */
  const d = pts => pts.map((p, i) => (i ? "L" : "M") + MR.toWorld(p[0], p[1]).map(v => v.toFixed(1)).join(",")).join("");
  function put(group, cls, pathD, extra) {
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", pathD); p.setAttribute("class", cls);
    if (extra) for (const k in extra) p.setAttribute(k, extra[k]);
    groups[group].appendChild(p); return p;
  }
  M.clear = g => { groups[g].innerHTML = ""; };
  M.drawTraverse = function (on) {
    M.clear("trav"); if (on) put("trav", "r-trav", d(MR.D.traverse));
  };
  M.drawCrism = function (on) {
    M.clear("crism"); if (!on) return;
    MR.D.objetivos.filter(o => o.box).forEach(o => {
      const [w, s, e, n] = o.box; const a = MR.toWorld(w, n), b = MR.toWorld(e, s);
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", a[0]); r.setAttribute("y", a[1]); r.setAttribute("width", b[0] - a[0]); r.setAttribute("height", b[1] - a[1]);
      r.setAttribute("class", "r-crism"); r.setAttribute("vector-effect", "non-scaling-stroke"); groups.crism.appendChild(r);
    });
  };
  M.drawShort = function (pts, hazards) {
    M.clear("short"); M.clear("shorthz"); if (!pts) return;
    put("short", "r-alt-casing", d(pts)); put("short", "r-alt", d(pts));
    (hazards || []).forEach(z => put("shorthz", "r-hz-short", d(pts.slice(Math.max(0, z.start - 1), z.end + 2))));
  };
  let animId = null;
  M.drawMain = function (pts, hazards, animate) {
    M.clear("main"); M.clear("hz"); if (!pts) return;
    const cas = put("main", "r-casing", ""), main = put("main", "r-main", "");
    const full = d(pts);
    const hz = () => (hazards || []).forEach(z => put("hz", "r-hz", d(pts.slice(Math.max(0, z.start - 1), z.end + 2))));
    if (!animate || MR.reduceMotion()) { cas.setAttribute("d", full); main.setAttribute("d", full); hz(); return; }
    // animación: la ruta "se dibuja sola"
    cancelAnimationFrame(animId);
    const t0 = performance.now(), dur = 1800;
    const step = now => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 2);
      const sub = d(pts.slice(0, Math.max(2, Math.floor(pts.length * e))));
      cas.setAttribute("d", sub); main.setAttribute("d", sub);
      if (u < 1) animId = requestAnimationFrame(step); else hz();
    };
    animId = requestAnimationFrame(step);
  };
  M.drawDone = function (pts, km, pos) {
    M.clear("done"); if (!pts || km <= 0) return;
    const i = MR.nearestKm(pts, km);
    const sub = pts.slice(0, i); if (pos) sub.push([pos[0], pos[1]]);
    if (sub.length > 1) put("done", "r-done", d(sub));
  };
  M.drawSecondary = function (list) {
    M.clear("sec"); (list || []).forEach(pts => pts && pts.length > 1 && put("sec", "r-sec", d(pts)));
  };
  M.drawMeasure = function (a, b) {
    M.clear("measure"); if (a && b) put("measure", "r-measure", d([a, b]));
  };

  /* ---------- marcadores HTML (tamaño constante) ---------- */
  M.setMarkers = function (list) {
    markerData = list;
    markersEl.querySelectorAll(".mk").forEach(n => n.remove());
    list.forEach(m => {
      const b = document.createElement("button");
      b.className = "mk" + (m.cls ? " " + m.cls : ""); b.dataset.t = m.type; b.type = "button";
      b.setAttribute("aria-label", m.label);
      if (m.type === "propuesta") b.innerHTML = `<span class="chip">${MR.ICONS.secundaria}<span></span></span>`;
      else b.innerHTML = `<span class="dot">${MR.ICONS[m.icon || m.type] || MR.ICONS.info}</span><span class="tag"></span>`;
      (b.querySelector(".tag") || b.querySelector(".chip span")).textContent = m.label;
      b.addEventListener("click", ev => { ev.stopPropagation(); m.onClick && m.onClick(m, ev); });
      m.node = b; markersEl.appendChild(b);
    });
    placeMarkers();
  };
  M.setAstronaut = function (pos, color, label) {
    if (!pos) { if (astro) astro.remove(); astro = null; return; }
    if (!astro) {
      astro = document.createElement("div"); astro.className = "astro";
      astro.innerHTML = '<span class="ring"></span><span class="core"></span><span class="lbl"></span>';
      markersEl.appendChild(astro);
    }
    astro.style.setProperty("--c", color); astro.querySelector(".lbl").textContent = label;
    astro._pos = pos; placeMarkers();
  };
  function placeMarkers() {
    markerData.forEach(m => {
      if (!m.node) return; const [x, y] = M.project(m.lon, m.lat);
      m.node.style.left = x + "px"; m.node.style.top = y + "px";
    });
    if (astro && astro._pos) { const [x, y] = M.project(astro._pos[0], astro._pos[1]); astro.style.left = x + "px"; astro.style.top = y + "px"; }
  }
})();
