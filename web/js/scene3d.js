/* =========================================================
   scene3d.js — relieve 3D con Three.js (DEM MOLA/HRSC)
   El terreno se construye en el navegador a partir de la grilla de alturas.
   ========================================================= */
(function () {
  "use strict";
  const MR = window.MR;
  const S3 = (MR.Scene3D = { ready: false });
  let renderer, scene, camera, controls, terrain, routeMesh, doneMesh, secMeshes = [], astro, beacon, pins = [], host;
  let exag = 2.5, follow = true, running = false;
  const SIZE = 100;                       // el terreno mide 100 × 100 unidades (≈ 53 km)
  const KM_PER_UNIT = 53.2 / SIZE;

  function heightAt(lon, lat) {
    const z = MR.sample("dem", lon, lat);
    return ((z - MR.D.layers.dem.min) / 1000 / KM_PER_UNIT) * exag;
  }
  function toXYZ(lon, lat, lift = 0.25) {
    const [wx, wy] = MR.toWorld(lon, lat);
    return new THREE.Vector3((wx / 1200 - 0.5) * SIZE, heightAt(lon, lat) + lift, (wy / 1200 - 0.5) * SIZE);
  }

  S3.init = function () {
    if (S3.ready || !window.THREE) return !!window.THREE;
    host = document.getElementById("map3d");
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a160d, 110, 260);
    scene.background = new THREE.Color(0x1d100a);
    camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 1000);
    camera.position.set(-30, 55, 75);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 6; controls.maxDistance = 200;
    controls.addEventListener("start", () => { if (follow) { follow = false; const f = document.getElementById("follow3d"); if (f) f.checked = false; } });
    scene.add(new THREE.HemisphereLight(0xfff2e6, 0x6a3a22, 1.05));
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xfff1e0, 0.85); sun.position.set(-60, 80, -40); scene.add(sun);
    buildTerrain();
    window.addEventListener("resize", resize);
    S3.ready = true;
    return true;
  };
  // Base procedural (relieve sombreado calculado desde el DEM). Se usa cuando el navegador
  // bloquea las imágenes locales (file://) como textura WebGL.
  function proceduralBase() {
    const G = MR.G, Z = MR.F.dem, lo = MR.D.layers.dem.min, hi = MR.D.layers.dem.max, span = (hi - lo) || 1;
    const stops = [[0, 112, 52, 32], [0.25, 150, 74, 42], [0.5, 186, 108, 64], [0.75, 214, 150, 98], [1, 236, 206, 160]];
    const small = document.createElement("canvas"); small.width = small.height = G;
    const sctx = small.getContext("2d"), img = sctx.createImageData(G, G), d = img.data;
    const at = (x, y) => Z[Math.min(G - 1, Math.max(0, y)) * G + Math.min(G - 1, Math.max(0, x))];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const t = (Z[y * G + x] - lo) / span;
      let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const a = stops[k], b = stops[k + 1], f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
      const dx = (at(x + 1, y) - at(x - 1, y)) / 88, dy = (at(x, y + 1) - at(x, y - 1)) / 88;
      const shade = Math.min(1.35, Math.max(0.45, 0.85 + 1.6 * (dx * 0.6 + dy * 0.8) * -1));
      const i = (y * G + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, (a[c + 1] + (b[c + 1] - a[c + 1]) * f) * shade);
      d[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const big = document.createElement("canvas"); big.width = big.height = 1200;
    const bctx = big.getContext("2d"); bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = "high";
    bctx.drawImage(small, 0, 0, 1200, 1200);
    return big;
  }
  function isTainted(c) { try { c.getContext("2d").getImageData(0, 0, 1, 1); return false; } catch (e) { return true; } }
  function buildTerrain() {
    if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
    const G = MR.G, geo = new THREE.PlaneGeometry(SIZE, SIZE, G - 1, G - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, Z = MR.F.dem, lo = MR.D.layers.dem.min;
    for (let i = 0; i < pos.count; i++) pos.setY(i, ((Z[i] - lo) / 1000 / KM_PER_UNIT) * exag);
    geo.computeVertexNormals();
    const tex = new THREE.Texture(S3.textureCanvas || proceduralBase());
    tex.needsUpdate = true; tex.anisotropy = 4;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, emissive: 0x777777, emissiveMap: tex }));
    scene.add(terrain);
  }
  // compone mapa base + capa de análisis en una textura
  S3.setTexture = function (baseImg, overlayCanvas, opacity) {
    let c = document.createElement("canvas"); c.width = c.height = 1200; let ctx = c.getContext("2d");
    try { ctx.drawImage(baseImg, 0, 0, 1200, 1200); } catch (e) { /* imagen aún no cargada */ }
    let target = c;
    if (isTainted(c)) { target = proceduralBase(); ctx = target.getContext("2d"); }  // file://: imagen bloqueada por el navegador
    if (overlayCanvas) { ctx.globalAlpha = opacity; ctx.imageSmoothingEnabled = true; ctx.drawImage(overlayCanvas, 0, 0, 1200, 1200); }
    c = target;
    S3.textureCanvas = c;
    if (terrain) {
      const tx = new THREE.Texture(c); tx.needsUpdate = true; if (THREE.sRGBEncoding) tx.encoding = THREE.sRGBEncoding;
      terrain.material.map = tx; terrain.material.emissiveMap = tx; terrain.material.needsUpdate = true;
    }
  };
  function tube(pts, color, radius, opacity = 1) {
    if (!pts || pts.length < 2) return null;
    const step = Math.max(1, Math.floor(pts.length / 500));
    const v = []; for (let i = 0; i < pts.length; i += step) v.push(toXYZ(pts[i][0], pts[i][1], 0.35));
    v.push(toXYZ(pts[pts.length - 1][0], pts[pts.length - 1][1], 0.35));
    const curve = new THREE.CatmullRomCurve3(v);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(1500, v.length * 3), radius, 6, false),
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
    scene.add(mesh); return mesh;
  }
  function dispose(m) { if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }
  let last = {};
  S3.update = function (st) {
    if (!S3.ready) return;
    last = st;
    dispose(routeMesh); routeMesh = tube(st.route, 0x4d8dff, 0.22);
    secMeshes.forEach(dispose); secMeshes = (st.secondary || []).map(p => tube(p, 0xa68bff, 0.18));
    S3.updatePins(st.pins || []);
    S3.updatePos(st);
  };
  S3.updatePos = function (st) {
    if (!S3.ready) return;
    dispose(doneMesh);
    if (st.route && st.km > 0.05) {
      const i = MR.nearestKm(st.route, st.km); doneMesh = tube(st.route.slice(0, Math.max(2, i + 1)), 0x46c882, 0.3);
    }
    if (!astro) {
      astro = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      scene.add(astro); scene.add(beacon);
    }
    if (st.pos) {
      const p = toXYZ(st.pos[0], st.pos[1], 0.8); astro.position.copy(p); beacon.position.set(p.x, p.y + 3, p.z);
      astro.material.color.set(st.color || "#1E64DC"); astro.visible = beacon.visible = true;
      if (follow) { controls.target.lerp(p, 0.25); }
    } else { astro.visible = beacon.visible = false; }
  };
  S3.updatePins = function (list) {
    pins.forEach(p => scene.remove(p)); pins = [];
    const col = { meta: 0xfc3d21, base: 0x1e64dc, mineral: 0x2f7fb8, espectral: 0x2f7fb8, ciencia: 0xb5651d, referencia: 0xc0c8d4, hallazgo: 0x46c882, secundaria: 0xa68bff, propuesta: 0xa68bff };
    list.forEach(m => {
      const g = new THREE.Group(); const base = toXYZ(m.lon, m.lat, 0);
      const c = col[m.type] || 0xffffff;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshBasicMaterial({ color: c }));
      stick.position.set(base.x, base.y + 1.5, base.z);
      const head = new THREE.Mesh(m.type === "meta" ? new THREE.ConeGeometry(0.7, 1.4, 4) : new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: c }));
      head.position.set(base.x, base.y + 3.3, base.z);
      g.add(stick); g.add(head); scene.add(g); pins.push(g);
    });
  };
  S3.setExag = function (v) { exag = v; if (!S3.ready) return; buildTerrain(); S3.update(last); };
  S3.setFollow = v => (follow = v);
  S3.start = function () {
    if (!S3.ready) return; running = true; resize();
    const loop = () => { if (!running) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); };
    loop();
  };
  S3.stop = () => (running = false);
  function resize() {
    if (!renderer || !host.clientWidth) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
  }
  S3.focus = function (lon, lat) {
    if (!S3.ready) return; const p = toXYZ(lon, lat, 0);
    controls.target.copy(p); camera.position.set(p.x - 26, p.y + 34, p.z + 40);
  };
})();
