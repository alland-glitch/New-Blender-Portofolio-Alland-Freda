/* =========================================================
   AETHER RENDER LAB — interactive layer
   Cursor, scroll reveals, skill bars, portfolio filter/modal,
   mobile nav, and the Three.js interactive 3D system.
   ========================================================= */

const ORANGE = 0xF5792A;
const BLUE   = 0x3AA6FF;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- CURSOR ---------- */
const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
function animCursor() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  if (dot) { dot.style.left = mx + 'px'; dot.style.top = my + 'px'; }
  if (ring) { ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; }
  requestAnimationFrame(animCursor);
}
animCursor();
function bindCursorHover() {
  document.querySelectorAll('a,button,.service-card,.port-card').forEach(el => {
    el.addEventListener('mouseenter', () => ring && (ring.style.transform = 'translate(-50%,-50%) scale(1.8)'));
    el.addEventListener('mouseleave', () => ring && (ring.style.transform = 'translate(-50%,-50%) scale(1)'));
  });
}
bindCursorHover();

/* ---------- REVEAL ON SCROLL ---------- */
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
reveals.forEach(el => io.observe(el));

/* ---------- SKILL BARS ---------- */
const skillIo = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.skill-fill').forEach(bar => {
        bar.classList.add('animated');
        bar.style.transform = `scaleX(${bar.dataset.width})`;
      });
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.skill-bars').forEach(el => skillIo.observe(el));

/* ---------- FORM SUBMIT (writes a real row into the messages table) ---------- */
async function handleSubmit(btn) {
  const errEl = document.getElementById('contactError');
  errEl.textContent = '';

  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const service = document.getElementById('contactService').value;
  const brief = document.getElementById('contactBrief').value.trim();

  if (!name || !email || !brief) {
    errEl.textContent = 'Nama, email, dan project brief wajib diisi.';
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Mengirim...';

  try {
    await window.AetherData.sendMessage({
      name, email,
      subject: service || 'Project Inquiry',
      body: brief,
    });
    btn.textContent = 'Message Sent! ✓';
    btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactBrief').value = '';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.disabled = false;
    }, 3000);
  } catch (err) {
    errEl.textContent = 'Gagal mengirim pesan, coba lagi.';
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/* ---------- MOBILE NAV ---------- */
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
const navOverlay = document.getElementById('navOverlay');

function openNav() {
  navLinks.classList.add('is-open');
  hamburger.classList.add('is-active');
  navOverlay.classList.add('is-open');
}
function closeNav() {
  navLinks.classList.remove('is-open');
  hamburger.classList.remove('is-active');
  navOverlay.classList.remove('is-open');
}
hamburger.addEventListener('click', () => {
  navLinks.classList.contains('is-open') ? closeNav() : openNav();
});
navOverlay.addEventListener('click', closeNav);

/* SMOOTH SCROLL + CLOSE MOBILE NAV */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    closeNav();
  });
});

/* =========================================================
   THREE.JS 3D SYSTEM
   ========================================================= */

function colorFor(accent) { return accent === 'blue' ? BLUE : ORANGE; }

function edgeLines(geometry, color, opacity = 0.85) {
  const edges = new THREE.EdgesGeometry(geometry, 1);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(edges, mat);
}
function wireLines(geometry, color, opacity = 0.5) {
  const wire = new THREE.WireframeGeometry(geometry);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(wire, mat);
}
function fillMesh(geometry, color, opacity = 0.07) {
  const mat = new THREE.MeshStandardMaterial({
    color, transparent: true, opacity, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide
  });
  return new THREE.Mesh(geometry, mat);
}
function addLights(scene) {
  scene.add(new THREE.AmbientLight(0x40465a, 1.2));
  const l1 = new THREE.PointLight(ORANGE, 1.3, 12); l1.position.set(2.5, 2, 3);
  const l2 = new THREE.PointLight(BLUE, 1.0, 12); l2.position.set(-2.5, -1.5, -3);
  scene.add(l1, l2);
}

/* Builds a themed low-poly "blueprint" object per portfolio category */
function buildShape(type, accent) {
  const c = colorFor(accent);
  const g = new THREE.Group();

  switch (type) {
    case 'torusknot': {
      const geo = new THREE.TorusKnotGeometry(0.62, 0.2, 120, 16);
      g.add(fillMesh(geo, c, 0.1));
      g.add(edgeLines(geo, c));
      break;
    }
    case 'icosahedron': {
      const geo = new THREE.IcosahedronGeometry(0.95, 0);
      g.add(fillMesh(geo, c, 0.08));
      g.add(edgeLines(geo, c, 0.9));
      break;
    }
    case 'arch': {
      const solid = new THREE.BoxGeometry(1.3, 1.6, 1.3);
      const grid = new THREE.BoxGeometry(1.3, 1.6, 1.3, 4, 5, 4);
      g.add(fillMesh(solid, c, 0.05));
      g.add(wireLines(grid, c, 0.55));
      break;
    }
    case 'villa': {
      const baseSolid = new THREE.BoxGeometry(1.5, 0.75, 1.0);
      const baseGrid = new THREE.BoxGeometry(1.5, 0.75, 1.0, 3, 2, 2);
      g.add(fillMesh(baseSolid, c, 0.05));
      g.add(wireLines(baseGrid, c, 0.55));
      const roof = new THREE.ConeGeometry(1.05, 0.5, 4);
      roof.rotateY(Math.PI / 4);
      roof.translate(0, 0.62, 0);
      g.add(fillMesh(roof, c, 0.06));
      g.add(edgeLines(roof, c, 0.7));
      break;
    }
    case 'bottle': {
      const body = new THREE.CylinderGeometry(0.4, 0.48, 1.1, 20);
      g.add(fillMesh(body, c, 0.09));
      g.add(edgeLines(body, c, 0.7));
      const neck = new THREE.CylinderGeometry(0.14, 0.2, 0.45, 16);
      neck.translate(0, 0.77, 0);
      g.add(fillMesh(neck, c, 0.09));
      g.add(edgeLines(neck, c, 0.7));
      break;
    }
    case 'animation': {
      const torusGeo = new THREE.TorusGeometry(0.6, 0.16, 10, 28);
      const torusGrp = new THREE.Group();
      torusGrp.add(fillMesh(torusGeo, ORANGE, 0.1));
      torusGrp.add(edgeLines(torusGeo, ORANGE, 0.8));
      g.add(torusGrp);

      const sphereGeo = new THREE.SphereGeometry(0.3, 16, 12);
      const sphereGrp = new THREE.Group();
      sphereGrp.position.set(0.85, 0.32, 0.15);
      sphereGrp.add(fillMesh(sphereGeo, BLUE, 0.1));
      sphereGrp.add(edgeLines(sphereGeo, BLUE, 0.8));
      g.add(sphereGrp);

      g.userData.spin = { torusGrp, sphereGrp };
      break;
    }
    default: {
      const geo = new THREE.IcosahedronGeometry(0.9, 0);
      g.add(fillMesh(geo, c, 0.08));
      g.add(edgeLines(geo, c));
    }
  }
  return g;
}

function disposeObject(obj) {
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}

/* Reusable interactive viewer: renderer + camera + controls + shape */
class Viewer3D {
  constructor(canvas, { shape, accent, cameraZ = 3, zoom = false, autoRotateSpeed = 1.3 }) {
    this.canvas = canvas;
    this.active = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, cameraZ);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    addLights(this.scene);
    this.group = buildShape(shape, accent);
    this.scene.add(this.group);
    this.controls = new THREE.OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableZoom = zoom;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 6.5;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = !prefersReducedMotion;
    this.controls.autoRotateSpeed = autoRotateSpeed;
    this.resize();
  }
  setShape(shape, accent) {
    this.scene.remove(this.group);
    disposeObject(this.group);
    this.group = buildShape(shape, accent);
    this.scene.add(this.group);
  }
  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  tick() {
    if (!this.active) return;
    this.controls.update();
    const spin = this.group.userData.spin;
    if (spin && !prefersReducedMotion) {
      spin.torusGrp.rotation.x += 0.006;
      spin.sphereGrp.rotation.y += 0.014;
      spin.sphereGrp.position.x = Math.cos(performance.now() * 0.0006) * 0.85;
      spin.sphereGrp.position.z = Math.sin(performance.now() * 0.0006) * 0.85;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

const viewers = [];

/* ---------- HERO 3D CENTERPIECE ---------- */
let heroViewer = null;
function initHero() {
  const canvas = document.getElementById('hero3d');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.6);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  addLights(scene);

  // Outer wire shell
  const outerGeo = new THREE.DodecahedronGeometry(1.55, 0);
  const outer = edgeLines(outerGeo, BLUE, 0.4);
  scene.add(outer);

  // Inner faceted core
  const innerGeo = new THREE.IcosahedronGeometry(0.85, 0);
  const inner = new THREE.Group();
  inner.add(fillMesh(innerGeo, ORANGE, 0.12));
  inner.add(edgeLines(innerGeo, ORANGE, 0.95));
  scene.add(inner);

  // Ambient particle field
  const PCOUNT = 140;
  const positions = new Float32Array(PCOUNT * 3);
  const colors = new Float32Array(PCOUNT * 3);
  const orangeC = new THREE.Color(ORANGE), blueC = new THREE.Color(BLUE);
  for (let i = 0; i < PCOUNT; i++) {
    const r = 3 + Math.random() * 3.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i*3+2] = r * Math.cos(phi) * 0.6 - 1;
    const col = Math.random() > 0.5 ? orangeC : blueC;
    colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Faint floor grid for depth
  const grid = new THREE.GridHelper(16, 24, ORANGE, 0x1c2230);
  grid.position.y = -2.1;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  scene.add(grid);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = !prefersReducedMotion;
  controls.autoRotateSpeed = 0.6;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  heroViewer = {
    active: true,
    tick() {
      if (!this.active) return;
      controls.update();
      if (!prefersReducedMotion) {
        inner.rotation.y += 0.0045;
        inner.rotation.x += 0.002;
        outer.rotation.y -= 0.0016;
        particles.rotation.y += 0.0006;
      }
      renderer.render(scene, camera);
    }
  };
  viewers.push(heroViewer);

  const heroIo = new IntersectionObserver(entries => {
    entries.forEach(e => { heroViewer.active = e.isIntersecting; });
  }, { threshold: 0.05 });
  heroIo.observe(canvas);
}

/* ---------- PORTFOLIO CARD MINI VIEWERS ---------- */
const cardViewers = new Map();

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Builds the filter buttons + project cards from the shared content DB
   (edited via the admin panel at /admin). Only "published" projects show. */
async function renderPublicPortfolio(db) {
  const published = db.projects.filter(p => p.status === 'published');

  const filterWrap = document.getElementById('portfolioFilter');
  const gridWrap = document.getElementById('portfolioGrid');
  if (!filterWrap || !gridWrap) return;

  const categoryNames = db.categories.map(c => c.name);
  filterWrap.innerHTML = ['All', ...categoryNames].map((name, i) => `
    <button class="filter-btn ${i === 0 ? 'active' : ''}" data-filter="${escapeHtml(name)}">${escapeHtml(name)}</button>
  `).join('');

  gridWrap.innerHTML = published.map(p => {
    const title = p.title || 'Untitled Project';
    const category = p.category || '';
    const tools = p.tools || '';
    const description = p.description || '';
    const shape = p.shape || 'icosahedron';
    const accent = p.accent || 'orange';
    return `
    <div class="port-card reveal" data-category="${escapeHtml(category)}" data-shape="${escapeHtml(shape)}" data-accent="${escapeHtml(accent)}"
         data-title="${escapeHtml(title)}" data-cat-label="${escapeHtml(category)}"
         data-tools="${escapeHtml(tools)}" data-desc="${escapeHtml(description)}">
      <div class="port-3d-wrap">
        <canvas class="port-3d"></canvas>
        <div class="port-badge">⬡ Drag to rotate</div>
        <div class="port-file">// ${escapeHtml(title.toUpperCase().replace(/\s+/g, '_'))}.blend</div>
      </div>
      <div class="port-overlay">
        <div class="port-cat">${escapeHtml(category)}</div>
        <div class="port-title">${escapeHtml(title)}</div>
        <div class="port-tools">${tools.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="port-tool">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    </div>`;
  }).join('');

  // re-trigger reveal-on-scroll for freshly injected cards
  gridWrap.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* Renders the 3 latest published articles as teaser cards on the homepage. */
function renderNewsTeaser(db) {
  const wrap = document.getElementById('newsTeaserGrid');
  if (!wrap) return;

  const latest = (db.news || [])
    .filter(n => n.status === 'published')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  if (!latest.length) {
    wrap.innerHTML = '<div class="news-empty">Belum ada berita yang dipublikasikan.</div>';
    return;
  }

  const dateFmt = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  wrap.innerHTML = latest.map(n => `
    <div class="news-card reveal">
      ${n.image_url
        ? `<div class="news-card-img" style="background-image:url('${n.image_url}')"></div>`
        : `<div class="news-card-bar accent-${n.accent}"></div>`}
      <div class="news-card-body">
        <span class="news-tag accent-${n.accent}">${escapeHtml(n.category)}</span>
        <div class="news-card-title">${escapeHtml(n.title)}</div>
        <div class="news-card-excerpt">${escapeHtml(n.excerpt)}</div>
        <div class="news-card-meta">
          <span class="news-card-date">${dateFmt(n.created_at)}</span>
          <a class="news-card-link" href="news.html?article=${encodeURIComponent(n.id)}">Baca selengkapnya →</a>
        </div>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

function initPortfolioCards() {
  const cards = document.querySelectorAll('.port-card');
  cards.forEach(card => {
    const canvas = card.querySelector('.port-3d');
    if (!canvas) return;
    const shape = card.dataset.shape || 'icosahedron';
    const accent = card.dataset.accent || 'orange';
    const v = new Viewer3D(canvas, { shape, accent, cameraZ: 3, zoom: false, autoRotateSpeed: 2.2 });
    v.active = false;
    viewers.push(v);
    cardViewers.set(card, v);
  });

  const cardIo = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = cardViewers.get(e.target);
      if (v) v.active = e.isIntersecting;
    });
  }, { threshold: 0.15 });
  cards.forEach(card => cardIo.observe(card));

  window.addEventListener('resize', () => {
    cardViewers.forEach(v => v.resize());
  });

  /* Click (not drag) opens the modal */
  cards.forEach(card => {
    let start = null;
    card.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
    card.addEventListener('pointerup', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) < 6) openPortfolioModal(card);
      start = null;
    });
  });
}

/* ---------- PORTFOLIO MODAL ---------- */
let modalViewer = null;
const modal = document.getElementById('portModal');
const modalCanvas = document.getElementById('portModalCanvas');
const modalClose = document.getElementById('portModalClose');
const modalBackdrop = document.getElementById('portModalBackdrop');

function openPortfolioModal(card) {
  document.getElementById('modalCat').textContent = card.dataset.catLabel || '';
  document.getElementById('modalTitle').textContent = card.dataset.title || '';
  document.getElementById('modalDesc').textContent = card.dataset.desc || '';

  const toolsWrap = document.getElementById('modalTools');
  toolsWrap.innerHTML = '';
  (card.dataset.tools || '').split(',').map(t => t.trim()).filter(Boolean).forEach(tool => {
    const span = document.createElement('span');
    span.className = 'port-tool';
    span.textContent = tool;
    toolsWrap.appendChild(span);
  });

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  const shape = card.dataset.shape || 'icosahedron';
  const accent = card.dataset.accent || 'orange';

  requestAnimationFrame(() => {
    if (!modalViewer) {
      modalViewer = new Viewer3D(modalCanvas, { shape, accent, cameraZ: 3.4, zoom: true, autoRotateSpeed: 1.6 });
      viewers.push(modalViewer);
    } else {
      modalViewer.setShape(shape, accent);
      modalViewer.controls.reset();
      modalViewer.camera.position.set(0, 0, 3.4);
    }
    modalViewer.active = true;
    modalViewer.resize();
  });
}
function closePortfolioModal() {
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
  if (modalViewer) modalViewer.active = false;
}
modalClose.addEventListener('click', closePortfolioModal);
modalBackdrop.addEventListener('click', closePortfolioModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePortfolioModal(); });

/* ---------- PORTFOLIO FILTER (functional) ---------- */
function initPortfolioFilter() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.port-card');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const match = filter === 'All' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });
}

/* ---------- MAIN RENDER LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  viewers.forEach(v => v.tick());
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  initHero();
  bindCursorHover();
  animate();

  let db;
  try {
    db = await window.AetherData.loadContentDB();
  } catch (err) {
    console.error('Failed to load content from Supabase', err);
    return;
  }

  try {
    await renderPublicPortfolio(db);
    initPortfolioCards();
    initPortfolioFilter();
  } catch (err) {
    console.error('Failed to render portfolio', err);
  }

  try {
    renderNewsTeaser(db);
  } catch (err) {
    console.error('Failed to render news teaser', err);
  }
});
