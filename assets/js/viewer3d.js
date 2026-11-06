/* LignoX — 3D viewer demo (lignox.ir/3d-ar/#try)
   A simplified, in-browser version of the LignoX product viewer: rotate/zoom, overall size,
   two-point measuring, exploded view, part select / hide / isolate, wireframe, three-view
   with dimensions, and STL / GLB download. The sofa model is procedural (built here),
   dimensions in millimetres. */
import * as THREE from 'three';
import { OrbitControls } from '/assets/vendor/three/addons/OrbitControls.js';
import { RoundedBoxGeometry } from '/assets/vendor/three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from '/assets/vendor/three/addons/RoomEnvironment.js';

const root = document.getElementById('v3d');
if (root) init(root);

function init(root) {
  const $ = s => root.querySelector(s);
  const fa = (n, d = 0) => Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d });
  const mm = m => fa(Math.round(m * 1000));
  const stage = $('.v3d-stage'), canvas = $('canvas'), overlay = $('.v3d-overlay'), live = $('.v3d-live');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- renderer / scene ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0xeef1f6, 1);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 4, 3); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a68, 0.7));
  const grid = new THREE.GridHelper(4, 20, 0xc9d1de, 0xdde3ec); grid.position.y = 0; scene.add(grid);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduced; controls.dampingFactor = 0.12;
  controls.target.set(0, 0.4, 0); controls.minDistance = 0.6; controls.maxDistance = 9;

  /* ---------------- model: «Aramis» 3-seat sofa (procedural) ---------------- */
  const fabTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#4a5a55'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + (y * 7 % 10) / 400})`; g.fillRect(0, y, 256, 1); }
    for (let x = 0; x < 256; x += 2) { g.fillStyle = 'rgba(0,0,0,.04)'; g.fillRect(x, 0, 1, 256); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const M = {
    fabric: () => new THREE.MeshStandardMaterial({ map: fabTex, roughness: 0.92, envMapIntensity: 0.45 }),
    wood: () => new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.45 }),
    linen: () => new THREE.MeshStandardMaterial({ color: 0xc9bba3, roughness: 0.95 }),
  };
  const model = new THREE.Group(); scene.add(model);
  const parts = [];
  function part(name, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.name = name; m.userData.base = m.position.clone(); model.add(m); parts.push(m); return m;
  }
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 5, r);
  const L = 0.16;
  part('بدنه', rb(2.1, 0.2, 0.9, 0.05), M.fabric(), 0, L + 0.1, 0);
  part('دسته راست', rb(0.15, 0.46, 0.9, 0.065), M.fabric(), -0.975, L + 0.23, 0);
  part('دسته چپ', rb(0.15, 0.46, 0.9, 0.065), M.fabric(), 0.975, L + 0.23, 0);
  part('پشتی', rb(1.76, 0.46, 0.17, 0.06), M.fabric(), 0, L + 0.42, -0.36, -0.08);
  [['راست', -0.585], ['وسط', 0], ['چپ', 0.585]].forEach(([n, x]) => {
    part('نشیمن ' + n, rb(0.575, 0.15, 0.68, 0.07), M.fabric(), x, L + 0.27, 0.08);
    part('کوسن پشتی ' + n, rb(0.575, 0.42, 0.17, 0.08), M.fabric(), x, L + 0.5, -0.2, -0.2);
  });
  part('کوسن تزئینی', rb(0.38, 0.36, 0.12, 0.09), M.linen(), -0.7, L + 0.5, -0.05, -0.25, 0.35, 0.12);
  [[-0.98, -0.38], [0.98, -0.38], [-0.98, 0.38], [0.98, 0.38]].forEach(([x, z], i) => {
    part('پایه ' + fa(i + 1), new THREE.CylinderGeometry(0.022, 0.014, L, 24), M.wood(), x, L / 2, z, 0, 0, x > 0 ? -0.08 : 0.08);
  });
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  parts.forEach(p => {
    const c = new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3());
    p.userData.dir = c.sub(center);
    p.userData.emissive = p.material.emissive.clone();
  });
  const tris = parts.reduce((a, p) => a + (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3, 0);

  /* ---------------- state ---------------- */
  let mode = 'select', explode = 0, wire = false, three = false;
  const selected = new Set();
  let needs = true; const req = () => { needs = true; };
  controls.addEventListener('change', req);

  function resetView() {
    camera.position.set(2.9, 1.7, 3.4); controls.target.set(0, 0.4, 0); controls.update(); req();
  }

  /* ---------------- sizing ---------------- */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); req();
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------------- info: size + parts ---------------- */
  function visibleBox() { const b = new THREE.Box3(); parts.forEach(p => p.visible && b.expandByObject(p)); return b; }
  function updateInfo() {
    const b = visibleBox(), s = b.isEmpty() ? new THREE.Vector3() : b.getSize(new THREE.Vector3());
    $('.v3d-size').innerHTML = `ابعاد کلی: <b class="ltr">${mm(s.x)} × ${mm(s.z)} × ${mm(s.y)} mm</b> <span>(طول × عمق × ارتفاع) · ${fa(Math.round(tris))} مثلث</span>`;
    const sel = [...selected];
    if (sel.length) {
      const sb = new THREE.Box3(); sel.forEach(p => sb.expandByObject(p)); const ss = sb.getSize(new THREE.Vector3());
      $('.v3d-sel').innerHTML = `انتخاب: <b>${sel.map(p => p.name).join('، ')}</b> — <span class="ltr">${mm(ss.x)} × ${mm(ss.z)} × ${mm(ss.y)} mm</span>`;
    } else $('.v3d-sel').textContent = mode === 'measure' ? 'دو نقطه روی مدل بزنید تا فاصله اندازه‌گیری شود.' : 'روی یک قطعه بزنید تا انتخاب شود (چند قطعه با Ctrl یا Shift).';
    $('#v3d-hide').disabled = $('#v3d-only').disabled = !sel.length;
    partsList();
  }
  function partsList() {
    $('.v3d-parts').innerHTML = parts.map((p, i) => `<li><label><input type="checkbox" data-i="${i}" ${p.visible ? 'checked' : ''}> <span class="${selected.has(p) ? 'on' : ''}">${p.name}</span></label></li>`).join('');
  }
  $('.v3d-parts').addEventListener('change', e => { const i = e.target.dataset.i; if (i === undefined) return; parts[i].visible = e.target.checked; if (!parts[i].visible) selected.delete(parts[i]); paintSel(); updateInfo(); req(); });

  function paintSel() {
    parts.forEach(p => { p.material.emissive.copy(selected.has(p) ? new THREE.Color(0x2f7bff) : p.userData.emissive); p.material.emissiveIntensity = selected.has(p) ? 0.35 : 1; });
  }

  /* ---------------- picking ---------------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || three) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved > 5) return;
    const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(parts.filter(p => p.visible), false)[0];
    if (mode === 'measure') { if (hit) addPoint(hit.point); return; }
    if (!hit) { selected.clear(); }
    else if (e.ctrlKey || e.shiftKey || e.metaKey) { selected.has(hit.object) ? selected.delete(hit.object) : selected.add(hit.object); }
    else { selected.clear(); selected.add(hit.object); }
    paintSel(); updateInfo(); req();
  });

  /* ---------------- measuring ---------------- */
  const mGroup = new THREE.Group(); scene.add(mGroup);
  let pts = [], mLabel = null;
  const dot = () => new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd93a3a, depthTest: false }));
  function clearMeasure() { mGroup.clear(); pts = []; if (mLabel) { mLabel.remove(); mLabel = null; } req(); }
  function addPoint(p) {
    if (pts.length === 2) clearMeasure();
    pts.push(p.clone()); const d = dot(); d.position.copy(p); d.renderOrder = 9; mGroup.add(d);
    if (pts.length === 2) {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd93a3a, depthTest: false })); line.renderOrder = 9; mGroup.add(line);
      const v = pts[1].clone().sub(pts[0]);
      mLabel = document.createElement('div'); mLabel.className = 'v3d-tag';
      mLabel.innerHTML = `<b class="ltr">${mm(v.length())} mm</b><small class="ltr">X ${mm(Math.abs(v.x))} · Y ${mm(Math.abs(v.y))} · Z ${mm(Math.abs(v.z))}</small>`;
      overlay.appendChild(mLabel);
      live.textContent = `فاصله اندازه‌گیری‌شده: ${mm(v.length())} میلی‌متر`;
    }
    req();
  }

  /* ---------------- toolbar ---------------- */
  const btn = id => $('#' + id);
  function setMode(m) {
    mode = m; btn('v3d-measure').setAttribute('aria-pressed', m === 'measure'); if (m !== 'measure') clearMeasure();
    canvas.style.cursor = m === 'measure' ? 'crosshair' : 'grab'; updateInfo();
  }
  btn('v3d-measure').addEventListener('click', () => setMode(mode === 'measure' ? 'select' : 'measure'));
  btn('v3d-wire').addEventListener('click', e => { wire = !wire; parts.forEach(p => p.material.wireframe = wire); e.currentTarget.setAttribute('aria-pressed', wire); req(); });
  btn('v3d-three').addEventListener('click', e => { three = !three; e.currentTarget.setAttribute('aria-pressed', three); if (three) setMode('select'); $('.v3d-3v').hidden = !three; req(); });
  btn('v3d-reset').addEventListener('click', () => { resetView(); });
  btn('v3d-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else root.querySelector('.v3d-main').requestFullscreen?.(); });
  btn('v3d-hide').addEventListener('click', () => { selected.forEach(p => p.visible = false); selected.clear(); paintSel(); updateInfo(); req(); });
  btn('v3d-only').addEventListener('click', () => { parts.forEach(p => p.visible = selected.has(p)); updateInfo(); req(); });
  btn('v3d-all').addEventListener('click', () => { parts.forEach(p => p.visible = true); selected.clear(); paintSel(); updateInfo(); req(); });
  const ex = btn('v3d-explode');
  ex.addEventListener('input', () => {
    explode = ex.value / 100; parts.forEach(p => p.position.copy(p.userData.base).addScaledVector(p.userData.dir, explode * 0.9));
    clearMeasure(); updateInfo(); req();
  });

  /* ---------------- downloads ---------------- */
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  btn('v3d-stl').addEventListener('click', async () => {
    const { STLExporter } = await import('/assets/vendor/three/addons/STLExporter.js');
    const wrap = new THREE.Group(); wrap.scale.setScalar(1000); // metres → millimetres
    parts.filter(p => p.visible).forEach(p => wrap.add(new THREE.Mesh(p.geometry, p.material).copy(p, false)));
    wrap.updateMatrixWorld(true);
    save(new Blob([new STLExporter().parse(wrap, { binary: true })], { type: 'model/stl' }), 'LignoX-Aramis-sofa.stl');
    live.textContent = 'فایل STL (میلی‌متر) دانلود شد.';
  });
  btn('v3d-glb').addEventListener('click', async () => {
    const { GLTFExporter } = await import('/assets/vendor/three/addons/GLTFExporter.js');
    const wrap = new THREE.Group(); parts.filter(p => p.visible).forEach(p => wrap.add(p.clone()));
    new GLTFExporter().parse(wrap, buf => { save(new Blob([buf], { type: 'model/gltf-binary' }), 'LignoX-Aramis-sofa.glb'); live.textContent = 'فایل GLB دانلود شد.'; }, err => console.error(err), { binary: true });
  });

  /* ---------------- three-view cameras ---------------- */
  const ortho = { top: new THREE.OrthographicCamera(), front: new THREE.OrthographicCamera(), side: new THREE.OrthographicCamera() };
  function fitOrtho(cam, w, h, aspect, pos, up) {
    const pad = 1.35; let hw = w / 2 * pad, hh = h / 2 * pad;
    if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.near = 0.01; cam.far = 50;
    const b = visibleBox(), c = b.getCenter(new THREE.Vector3());
    cam.position.copy(c).add(pos); cam.up.copy(up); cam.lookAt(c); cam.updateProjectionMatrix();
  }

  /* ---------------- render loop ---------------- */
  const v = new THREE.Vector3();
  function render() {
    requestAnimationFrame(render);
    if (controls.enableDamping) controls.update();
    if (!needs) return; needs = false;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!three) {
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); grid.visible = true; renderer.render(scene, camera);
      if (mLabel && pts.length === 2) {
        v.copy(pts[0]).add(pts[1]).multiplyScalar(0.5).project(camera);
        mLabel.style.left = ((v.x + 1) / 2 * w) + 'px'; mLabel.style.top = ((1 - v.y) / 2 * h) + 'px';
      }
      return;
    }
    // three-view: 2×2 — 3D (top-right), top, front, side
    const b = visibleBox(); if (b.isEmpty()) return; const s = b.getSize(new THREE.Vector3());
    const hw = Math.floor(w / 2), hh = Math.floor(h / 2), aspect = hw / hh;
    grid.visible = false; renderer.setScissorTest(true);
    const views = [
      [hw, hh, camera, null],
      [0, hh, ortho.top, () => fitOrtho(ortho.top, s.x, s.z, aspect, new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, -1))],
      [hw, 0, ortho.front, () => fitOrtho(ortho.front, s.x, s.y, aspect, new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 1, 0))],
      [0, 0, ortho.side, () => fitOrtho(ortho.side, s.z, s.y, aspect, new THREE.Vector3(10, 0, 0), new THREE.Vector3(0, 1, 0))],
    ];
    const oa = camera.aspect; camera.aspect = aspect; camera.updateProjectionMatrix();
    for (const [x, y, cam, fit] of views) {
      if (fit) fit(); renderer.setViewport(x, y, hw, hh); renderer.setScissor(x, y, hw, hh);
      renderer.setClearColor(fit ? 0xf8fafc : 0xeef1f6, 1); renderer.render(scene, cam);
    }
    camera.aspect = oa; camera.updateProjectionMatrix(); renderer.setClearColor(0xeef1f6, 1);
    $('[data-v="top"]').textContent = `نمای بالا — ${mm(s.x)} × ${mm(s.z)} mm`;
    $('[data-v="front"]').textContent = `نمای روبه‌رو — ${mm(s.x)} × ${mm(s.y)} mm`;
    $('[data-v="side"]').textContent = `نمای جانبی — ${mm(s.z)} × ${mm(s.y)} mm`;
  }
  resetView(); resize(); updateInfo(); setMode('select'); render();
  root.classList.add('ready');
}
