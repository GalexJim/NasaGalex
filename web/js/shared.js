/* =========================================================
   shared.js — avisos compartidos entre exploradores
   Un hallazgo o una alerta registrada por un explorador llega como aviso a los demás
   (zona en el mapa + mensaje en su bitácora). Cada uno sigue con su viaje separado:
   el aviso no cambia su ruta ni su reloj.

   Dónde viven los avisos:
     · localStorage ("mr_shared"): siempre. Sin servidor, dos pestañas del mismo navegador
       se avisan entre sí por el evento "storage".
     · Backend (SQLite tabla aviso + eventos en JSONL): si la página se sirve con backend/server.py,
       se sincroniza cada pocos segundos, así que otros navegadores también los reciben.
   ========================================================= */
(function () {
  "use strict";
  const MR = window.MR, KEY = "shared", MAX = 300, POLL_MS = 4000;
  const S = (MR.Shared = { list: [], subs: [] });

  // radiusKm solo dimensiona la zona dibujada en el mapa (ayuda visual); no es una distancia de seguridad medida
  S.kinds = {
    hallazgo: { label: "Hallazgo", radiusKm: 0.5, icon: "hallazgo" },
    alerta_pendiente: { label: "Alerta de pendiente", radiusKm: 0.8, icon: "warn" },
    alerta_radiacion: { label: "Alerta de radiación", radiusKm: 1.5, icon: "warn" },
  };
  let seq = 1;
  const newId = () => "av_" + Date.now().toString(36) + (seq++) + Math.random().toString(36).slice(2, 6);
  const valid = n => n && typeof n.id === "string" && S.kinds[n.kind] && typeof n.author === "string" && isFinite(n.lon) && isFinite(n.lat);

  // incorpora avisos a la lista (sin duplicar por id); devuelve qué es nuevo y qué cambió
  function absorb(items) {
    const added = [], changed = [];
    (items || []).forEach(n => {
      if (!valid(n)) return;
      const cur = S.list.find(x => x.id === n.id);
      if (!cur) { const c = Object.assign({ estado: "activo" }, n); S.list.push(c); added.push(c); }
      else if (cur.estado !== "retirado" && n.estado === "retirado") { cur.estado = "retirado"; changed.push(cur); }
    });
    if (S.list.length > MAX) S.list = S.list.slice(-MAX);
    return { added, changed };
  }
  function notify(res, silent) {
    if (!res.added.length && !res.changed.length) return;
    S.subs.forEach(fn => { try { fn(res, !!silent); } catch (e) { /* un suscriptor roto no frena a los demás */ } });
  }
  // lee lo guardado por otras pestañas antes de escribir, para no pisarlo
  function persist() {
    const res = absorb(MR.store.get(KEY, []));
    MR.store.set(KEY, S.list);
    return res;
  }
  S.onChange = fn => { S.subs.push(fn); };

  // carga inicial (silenciosa: no repite banners de avisos viejos)
  S.load = function () { const res = absorb(MR.store.get(KEY, [])); notify(res, true); };

  S.publish = function ({ kind, author, lon, lat, text, simMin, region }) {
    const n = { id: newId(), author, kind, text: MR.clean(text, 280), lon, lat, radiusKm: S.kinds[kind].radiusKm, region: region || "gale",
      simMin, estado: "activo", creado: new Date().toISOString() };
    const mine = absorb([n]); const other = persist();
    notify({ added: mine.added.concat(other.added), changed: other.changed });
    MR.API.sendAviso(n);
    return n;
  };
  S.retract = function (id, crew) {
    const n = S.list.find(x => x.id === id); if (!n || n.author !== crew || n.estado === "retirado") return;
    n.estado = "retirado"; persist(); notify({ added: [], changed: [n] });
    MR.API.retractAviso(id, crew);
  };
  S.ack = (id, crew) => MR.API.ackAviso(id, crew);

  // avisos de otros exploradores visibles para `crewId` en la región dada
  S.visibleFor = (crewId, region) => S.list.filter(n => n.estado === "activo" && n.author !== crewId && (n.region || "gale") === region);

  // sincroniza con el backend: trae lo ajeno y sube lo que quedó sin enviar (el servidor ignora los repetidos)
  S.sync = async function () {
    const remote = await MR.API.getAvisos(); if (!remote) return;
    const ids = new Set(remote.map(r => r.id));
    const res = absorb(remote.map(r => Object.assign({}, r, { estado: r.estado })));
    const other = persist(); notify({ added: res.added.concat(other.added), changed: res.changed.concat(other.changed) });
    S.list.filter(n => !ids.has(n.id) && n.estado === "activo").forEach(n => MR.API.sendAviso(n));
  };
  S.startPolling = function () { if (S.timer) return; S.sync(); S.timer = setInterval(S.sync, POLL_MS); };

  // otra pestaña del mismo navegador escribió avisos (funciona también por file://)
  window.addEventListener("storage", e => {
    if (e.key !== "mr_" + KEY || !e.newValue) return;
    try { const res = absorb(JSON.parse(e.newValue)); notify(res); } catch (err) { /* valor dañado: se ignora */ }
  });
})();
