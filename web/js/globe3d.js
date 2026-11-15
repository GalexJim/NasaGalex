/* =========================================================
   globe3d.js — Visor planetario 3D global de Marte con Three.js
   Integrado dentro de la GUI principal de Mars Route Planner.
   Utiliza teselas DEM locales (Mapbox Terrarium PNG) de MOLA
   y capas de relieve de NASA Mars Trek.
   ========================================================= */
(function () {
  "use strict";

  const MR = window.MR || (window.MR = {});
  const G3 = (MR.Globe3D = { ready: false });

  const BASE_URL = "https://trek.nasa.gov/tiles/Mars/EQ";
  const LOCAL_DEM_PATH = "3dView/dem_tiles";
  const SEGS = 48;                 // Resolución de malla por tesela (equilibrio rendimiento/detalle)
  const RADIUS = 3;                // Radio de teselas visibles alrededor del centro (7x7)
  const M_PER_DEG = 59200;         // Metros por grado aproximado en Marte
  const $ = id => document.getElementById(id);

  let host, renderer, scene, camera, controls;
  let running = false, alive = true;
  let lastKey = "";
  let currentZ = 0;
  let currentNeeded = new Set();
  const tiles = new Map();         // clave -> { mesh, z }
  const pending = new Set();
  let fallbackUsed = false;
  let fly = null;
  let raycaster, mouse;
  const beacons = [];

  const cfg = {
    dem: "mola128_mola64_merge_90Nto90S_SimpleC_clon0",
    col: "Mars_MGS_MOLA_ClrShade_merge_global_463m", // o "Mars_Viking_MDIM21_ClrMosaic_global_232m"
    maxZ: 6,
    exag: 6.0,
    hmin: -8200,
    hmax: 21200,
    local: LOCAL_DEM_PATH
  };

  const LOCATIONS = [
    { id: "gale", name: "Cráter Gale", sub: "Misión Curiosity (MSL)", lon: 137.4, lat: -4.6, elev: -4500, hCam: 4.5, color: 0x00e5ff },
    { id: "jezero", name: "Cráter Jezero", sub: "Misión Perseverance (Mars 2020)", lon: 77.45, lat: 18.38, elev: -2500, hCam: 4.5, color: 0xff3b30 },
    { id: "olympus", name: "Olympus Mons", sub: "Volcán más alto del Sistema Solar (+21.2 km)", lon: -133.8, lat: 18.65, elev: 21200, hCam: 14, color: 0xffa000 },
    { id: "valles", name: "Valles Marineris", sub: "Gran Cañón marciano (4,000 km)", lon: -59.0, lat: -14.0, elev: -3000, hCam: 22, color: 0x4caf50 },
    { id: "hellas", name: "Hellas Planitia", sub: "Cuenca de impacto gigante (-8.2 km)", lon: 70.0, lat: -42.0, elev: -8200, hCam: 16, color: 0xab47bc },
    { id: "global", name: "Vista Global", sub: "Hemisferio oriental y occidental", lon: 0.0, lat: 0.0, elev: 0, hCam: 120, color: 0xffffff }
  ];

  /* ---------- Inicialización ---------- */
  G3.init = function () {
    if (G3.ready || !window.THREE) return !!window.THREE;
    host = $("mapGlobe");
    if (!host) return false;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const sky = new THREE.Color(0x180d09);
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 15, 75);

    camera = new THREE.PerspectiveCamera(45, (host.clientWidth || window.innerWidth) / (host.clientHeight || window.innerHeight), 0.001, 2500);
    camera.position.set(0, 110, 55);

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.15);
    sun.position.set(-1.2, 1.8, 0.7);
    scene.add(sun);

    // Controles tipo mapa sobre el plano
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
    controls.minDistance = 0.03;
    controls.maxDistance = 260;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.target.set(137.4, 0, 4.6);

    createBeacons();
    setupInteraction();

    window.addEventListener("resize", G3.resize);
    G3.ready = true;
    return true;
  };

  /* ---------- Utilidades de Teselas ---------- */
  const tilesX = z => 2 ** (z + 1);
  const tilesY = z => 2 ** z;
  const tileDeg = z => 180 / 2 ** z;

  function tileURL(layer, z, r, c, ext = "jpg") {
    return `${BASE_URL}/${layer}/1.0.0/default/default028mm/${z}/${r}/${c}.${ext}`;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Error cargando: " + url));
      img.src = url;
    });
  }

  // Ruido procedimental FBM para contingencia sin conexión
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) +
           (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
  }
  function fbm(lon, lat) {
    let a = 0.5, f = 0.08, s = 0;
    for (let i = 0; i < 6; i++) { s += a * vnoise(lon * f, lat * f); f *= 2; a *= 0.5; }
    return s;
  }
  function ramp(t) {
    const stops = [[0, [40, 20, 40]], [0.25, [120, 50, 30]], [0.5, [190, 110, 60]], [0.75, [225, 170, 120]], [1, [250, 240, 235]]];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
        return c0.map((v, j) => (v + (c1[j] - v) * k) / 255);
      }
    }
    return [1, 1, 1];
  }

  async function buildTile(z, r, c) {
    const key = `${z}/${r}/${c}`;
    const td = tileDeg(z);
    const lon0 = -180 + c * td, lat1 = 90 - r * td;

    const loadDem = async () => {
      if (cfg.local) {
        try { return { img: await loadImage(`${cfg.local}/${z}/${r}/${c}.png`), terr: true }; } catch (e) {}
        try { return { img: await loadImage(`3dView/${cfg.local}/${z}/${r}/${c}.png`), terr: true }; } catch (e) {}
      }
      try { return { img: await loadImage(tileURL(cfg.dem, z, r, c, "png")), terr: false }; } catch (e) {}
      try { return { img: await loadImage(tileURL(cfg.dem, z, r, c, "jpg")), terr: false }; } catch (e) {}
      return null;
    };

    const [demRes, colImg] = await Promise.all([
      loadDem(),
      loadImage(tileURL(cfg.col, z, r, c, "jpg")).catch(() => null)
    ]);

    const demImg = demRes && demRes.img;
    const terr = !!(demRes && demRes.terr);

    let pix = null;
    if (demImg) {
      try {
        const cv = document.createElement("canvas");
        cv.width = demImg.width; cv.height = demImg.height;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(demImg, 0, 0);
        pix = ctx.getImageData(0, 0, cv.width, cv.height);
      } catch (e) { pix = null; }
    }
    if (!pix) fallbackUsed = true;

    const n = SEGS + 1;
    const pos = new Float32Array(n * n * 3);
    const uvs = new Float32Array(n * n * 2);
    const colors = new Float32Array(n * n * 3);
    const idx = [];
    const k = cfg.exag / M_PER_DEG;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const u = j / SEGS, v = i / SEGS;
        const lon = lon0 + u * td, lat = lat1 - v * td;
        let t, meters;
        if (pix) {
          const px = Math.min(pix.width - 1, Math.round(u * (pix.width - 1)));
          const py = Math.min(pix.height - 1, Math.round(v * (pix.height - 1)));
          const o = (py * pix.width + px) * 4;
          if (terr) {
            meters = pix.data[o] * 256 + pix.data[o + 1] + pix.data[o + 2] / 256 - 32768;
            t = Math.min(1, Math.max(0, (meters - cfg.hmin) / (cfg.hmax - cfg.hmin)));
          } else {
            t = pix.data[o] / 255;
            meters = cfg.hmin + t * (cfg.hmax - cfg.hmin);
          }
        } else {
          t = Math.min(1, Math.max(0, fbm(lon, lat) * 1.3 - 0.1));
          meters = cfg.hmin + t * (cfg.hmax - cfg.hmin);
        }
        const p = (i * n + j) * 3;
        pos[p] = lon;
        pos[p + 1] = meters * k - (cfg.maxZ - z) * 0.08 * cfg.exag;
        pos[p + 2] = -lat;
        uvs[(i * n + j) * 2] = u;
        uvs[(i * n + j) * 2 + 1] = 1 - v;
        const col = ramp(t);
        colors[p] = col[0]; colors[p + 1] = col[1]; colors[p + 2] = col[2];
      }
    }

    for (let i = 0; i < SEGS; i++) {
      for (let j = 0; j < SEGS; j++) {
        const a = i * n + j, b = a + 1, c2 = a + n, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(idx);

    let mat;
    const po = { polygonOffset: true, polygonOffsetFactor: -z, polygonOffsetUnits: -z };
    if (colImg) {
      const tex = new THREE.Texture(colImg);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      mat = new THREE.MeshBasicMaterial({ map: tex, ...po });
    } else {
      geo.computeVertexNormals();
      mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...po });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = true;
    return { key, mesh, z };
  }

  function disposeTile(t) {
    scene.remove(t.mesh);
    t.mesh.geometry.dispose();
    if (t.mesh.material.map) t.mesh.material.map.dispose();
    t.mesh.material.dispose();
  }

  function ensure(z, r, c) {
    const key = `${z}/${r}/${c}`;
    if (tiles.has(key) || pending.has(key)) return;
    pending.add(key);
    buildTile(z, r, c).then(t => {
      pending.delete(key);
      if (!alive) { disposeTile(t); return; }
      tiles.set(key, t);
      scene.add(t.mesh);
      cleanup();
    });
  }

  function chooseZoom() {
    if (!controls) return 0;
    const h = Math.max(0.01, camera.position.distanceTo(controls.target));
    const span = 0.93 * h * (host.clientWidth / host.clientHeight > 1 ? 1 : host.clientHeight / host.clientWidth);
    const z = Math.round(Math.log2((180 * 3) / span));
    return Math.max(0, Math.min(cfg.maxZ, z));
  }

  function updateTiles() {
    if (!controls) return;
    const z = chooseZoom();
    currentZ = z;
    const td = tileDeg(z);
    const lon = controls.target.x, lat = -controls.target.z;
    const cc = Math.floor((lon + 180) / td), cr = Math.floor((90 - lat) / td);
    currentNeeded = new Set();

    // Nivel base z=0 (siempre presente para visión periférica global)
    for (let c = 0; c < tilesX(0); c++) {
      currentNeeded.add(`0/0/${c}`);
      ensure(0, 0, c);
    }
    // Teselas en la vecindad del foco actual
    for (let dr = -RADIUS; dr <= RADIUS; dr++) {
      for (let dc = -RADIUS; dc <= RADIUS; dc++) {
        const r = cr + dr, c = cc + dc;
        if (r < 0 || r >= tilesY(z) || c < 0 || c >= tilesX(z)) continue;
        currentNeeded.add(`${z}/${r}/${c}`);
        ensure(z, r, c);
      }
    }
    cleanup();
  }

  function cleanup() {
    for (const key of currentNeeded) if (!tiles.has(key)) return;
    for (const [key, t] of tiles) {
      if (!currentNeeded.has(key)) {
        disposeTile(t);
        tiles.delete(key);
      }
    }
  }

  /* ---------- Balizas y Marcadores Planetarios ---------- */
  function createBeacons() {
    LOCATIONS.forEach(loc => {
      const group = new THREE.Group();
      const k = cfg.exag / M_PER_DEG;
      const yBase = loc.elev * k;

      // Anillo emisor en suelo
      const ringGeo = new THREE.RingGeometry(0.2, 0.45, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: loc.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      group.add(ring);

      // Columna de luz vertical
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.6, 12);
      beamGeo.translate(0, 0.8, 0);
      const beamMat = new THREE.MeshBasicMaterial({ color: loc.color, transparent: true, opacity: 0.75 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      group.add(beam);

      // Diamante flotante en la punta
      const octaGeo = new THREE.OctahedronGeometry(0.35, 0);
      octaGeo.translate(0, 1.8, 0);
      const octaMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const diamond = new THREE.Mesh(octaGeo, octaMat);
      group.add(diamond);

      group.position.set(loc.lon, yBase, -loc.lat);
      group.userData = { loc, diamond, ring, initialY: yBase };
      scene.add(group);
      beacons.push(group);
    });
  }

  function setupInteraction() {
    if (!renderer) return;
    renderer.domElement.addEventListener("click", onGlobeClick);
    renderer.domElement.addEventListener("mousemove", onGlobeMouseMove);
  }

  function onGlobeClick(e) {
    if (!G3.ready || !running) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hit = raycaster.intersectObjects(beacons, true);
    if (hit.length > 0) {
      let root = hit[0].object;
      while (root.parent && root.parent !== scene) root = root.parent;
      if (root.userData && root.userData.loc) {
        const loc = root.userData.loc;
        G3.flyTo(loc.lon, loc.lat, loc.hCam);
        showLocationCard(loc, e.clientX, e.clientY);
      }
    }
  }

  function onGlobeMouseMove(e) {
    if (!G3.ready || !running) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hit = raycaster.intersectObjects(beacons, true);
    renderer.domElement.style.cursor = hit.length > 0 ? "pointer" : "default";
  }

  function showLocationCard(loc, x, y) {
    const card = $("stageCard");
    if (!card) return;
    let extraActions = "";
    if (loc.id === "gale" || loc.id === "jezero") {
      extraActions = `
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-primary" id="btnExplore2D" style="flex:1;">Ver en Mapa 2D</button>
          <button class="btn" id="btnExplore3D" style="flex:1;">Ver Relieve Cráter 3D</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-head" style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px;">
        <span class="badge" style="background:${loc.color}22;color:${loc.color};border:1px solid ${loc.color}55;">HITO PLANETARIO</span>
        <h3 style="margin:4px 0 2px 0;">${loc.name}</h3>
        <div style="font-size:12px;color:var(--text-2);">${loc.sub}</div>
      </div>
      <div style="font-size:13px;line-height:1.4;">
        <div><b>Longitud:</b> ${loc.lon.toFixed(2)}°</div>
        <div><b>Latitud:</b> ${loc.lat.toFixed(2)}°</div>
        <div><b>Elevación de referencia:</b> ${(loc.elev).toLocaleString()} m</div>
      </div>
      ${extraActions}
      <button class="btn btn-close" id="btnCloseLocCard" style="margin-top:10px;width:100%;">Cerrar</button>
    `;

    card.hidden = false;
    card.style.top = Math.min(window.innerHeight - 240, Math.max(80, y - 50)) + "px";
    card.style.left = Math.min(window.innerWidth - 320, Math.max(20, x + 20)) + "px";

    $("btnCloseLocCard").addEventListener("click", () => { card.hidden = true; });
    const b2d = $("btnExplore2D");
    if (b2d) {
      b2d.addEventListener("click", () => {
        card.hidden = true;
        if (window.MR && window.MR.setRegion) {
          window.MR.setRegion(loc.id);
          const sel = $("regionSelect"); if (sel) sel.value = loc.id;
        }
        const b = document.querySelector('.viewswitch button[data-view="2d"]');
        if (b) b.click();
      });
    }
    const b3d = $("btnExplore3D");
    if (b3d) {
      b3d.addEventListener("click", () => {
        card.hidden = true;
        if (window.MR && window.MR.setRegion) {
          window.MR.setRegion(loc.id);
          const sel = $("regionSelect"); if (sel) sel.value = loc.id;
        }
        const b = document.querySelector('.viewswitch button[data-view="3d"]');
        if (b) b.click();
      });
    }
  }

  /* ---------- Navegación y Vuelo (flyTo) ---------- */
  G3.flyTo = function (lon, lat, h, dur = 1600) {
    if (!controls) return;
    const t1 = new THREE.Vector3(lon, 0, -lat);
    const p1 = new THREE.Vector3(lon, h, -lat + h * 0.7);
    fly = {
      t0: controls.target.clone(),
      p0: camera.position.clone(),
      t1, p1,
      s: performance.now(),
      d: dur
    };
  };

  G3.goToRegion = function (regionId) {
    if (regionId === "jezero") G3.flyTo(77.45, 18.38, 4.5);
    else if (regionId === "gale") G3.flyTo(137.4, -4.6, 4.5);
  };

  G3.setExag = function (val) {
    cfg.exag = Math.max(1, Math.min(30, val));
    G3.resetTerrain();
  };

  G3.setLayer = function (layerKey) {
    if (layerKey === "viking") {
      cfg.col = "Mars_Viking_MDIM21_ClrMosaic_global_232m";
    } else {
      cfg.col = "Mars_MGS_MOLA_ClrShade_merge_global_463m";
    }
    G3.resetTerrain();
  };

  G3.resetTerrain = function () {
    for (const t of tiles.values()) disposeTile(t);
    tiles.clear();
    pending.clear();
    currentNeeded.clear();
    fallbackUsed = false;
    updateTiles();
  };

  /* ---------- Control del Bucle de Renderizado ---------- */
  G3.start = function () {
    if (!G3.ready) G3.init();
    running = true;
    G3.resize();
    updateTiles();

    const loop = (now) => {
      if (!running) return;
      if (fly) {
        const k = Math.min(1, (now - fly.s) / fly.d);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        controls.target.lerpVectors(fly.t0, fly.t1, e);
        camera.position.lerpVectors(fly.p0, fly.p1, e);
        if (k >= 1) fly = null;
      }
      controls.update();

      // Limitar el objetivo a los límites planetarios equirectangulares
      controls.target.x = Math.max(-180, Math.min(180, controls.target.x));
      controls.target.z = Math.max(-90, Math.min(90, controls.target.z));

      const dist = camera.position.distanceTo(controls.target);
      scene.fog.near = dist * 1.3;
      scene.fog.far = dist * 2.8 + 5;

      // Animación sutil de las balizas
      const tSec = now * 0.0025;
      beacons.forEach((b, idx) => {
        if (b.userData && b.userData.diamond) {
          b.userData.diamond.rotation.y = tSec + idx;
          b.userData.diamond.position.y = 1.8 + Math.sin(tSec * 2 + idx) * 0.12;
        }
      });

      // Detección de cambio de celda / zoom para streaming de teselas
      const zoom = chooseZoom();
      const td = tileDeg(zoom);
      const cellX = Math.floor((controls.target.x + 180) * 4 / td);
      const cellY = Math.floor((controls.target.z + 90) * 4 / td);
      const key = `${zoom}|${cellX}|${cellY}`;
      if (key !== lastKey) {
        lastKey = key;
        updateTiles();
      }

      // Actualizar lectura de coordenadas en la interfaz
      const readout = $("globeCoords");
      if (readout) {
        const altKm = (dist * M_PER_DEG / 1000).toFixed(0);
        readout.textContent = `Lon ${controls.target.x.toFixed(2)}°  Lat ${(-controls.target.z).toFixed(2)}°  ·  Altitud: ${altKm} km`;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  };

  G3.stop = function () {
    running = false;
  };

  G3.resize = function () {
    if (!renderer || !host || !host.clientWidth) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  };
})();
