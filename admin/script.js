/* =========================================================
   AETHER RENDER LAB — ADMIN PANEL (Supabase edition)
   Talks to a real Supabase project (Postgres + Auth + Storage)
   via window.AetherData (see ../data.js). No more localStorage
   for content/accounts — only Supabase's own session token is
   kept in the browser (handled internally by supabase-js).
   ========================================================= */

const { uid } = window.AetherData;

let DB = null; // { projects, categories, services, skills, testimonials, news, settings }

async function loadDB() { DB = await window.AetherData.loadContentDB(); }

function logActivity(icon, text) {
  window.AetherData.logActivity(icon, text); // fire-and-forget, non-blocking
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return `${Math.floor(d / 30)} bulan lalu`;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- TOAST ---------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* ---------- MODAL ---------- */
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.add('is-open');
}
function closeModal() {
  modal.classList.remove('is-open');
  modalBody.innerHTML = '';
  AdminPreview3D.stop();
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* =========================================================
   LIVE 3D SHAPE PREVIEW (mirrors the shapes used on the
   public site, so admins see exactly what visitors will see)
   ========================================================= */
const AdminPreview3D = (function () {
  const ORANGE = 0xF5792A, BLUE = 0x3AA6FF;
  let renderer, scene, camera, controls, group, rafId;

  function colorFor(accent) { return accent === 'blue' ? BLUE : ORANGE; }
  function edgeLines(geo, color, opacity = 0.85) {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), mat);
  }
  function wireLines(geo, color, opacity = 0.5) {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineSegments(new THREE.WireframeGeometry(geo), mat);
  }
  function fillMesh(geo, color, opacity = 0.08) {
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }
  function buildShape(type, accent) {
    const c = colorFor(accent);
    const g = new THREE.Group();
    switch (type) {
      case 'torusknot': { const geo = new THREE.TorusKnotGeometry(0.62, 0.2, 120, 16); g.add(fillMesh(geo, c, 0.1), edgeLines(geo, c)); break; }
      case 'icosahedron': { const geo = new THREE.IcosahedronGeometry(0.95, 0); g.add(fillMesh(geo, c, 0.08), edgeLines(geo, c, 0.9)); break; }
      case 'arch': {
        const solid = new THREE.BoxGeometry(1.3, 1.6, 1.3), grid = new THREE.BoxGeometry(1.3, 1.6, 1.3, 4, 5, 4);
        g.add(fillMesh(solid, c, 0.05), wireLines(grid, c, 0.55)); break;
      }
      case 'villa': {
        const baseSolid = new THREE.BoxGeometry(1.5, 0.75, 1.0), baseGrid = new THREE.BoxGeometry(1.5, 0.75, 1.0, 3, 2, 2);
        g.add(fillMesh(baseSolid, c, 0.05), wireLines(baseGrid, c, 0.55));
        const roof = new THREE.ConeGeometry(1.05, 0.5, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 0.62, 0);
        g.add(fillMesh(roof, c, 0.06), edgeLines(roof, c, 0.7)); break;
      }
      case 'bottle': {
        const body = new THREE.CylinderGeometry(0.4, 0.48, 1.1, 20);
        g.add(fillMesh(body, c, 0.09), edgeLines(body, c, 0.7));
        const neck = new THREE.CylinderGeometry(0.14, 0.2, 0.45, 16); neck.translate(0, 0.77, 0);
        g.add(fillMesh(neck, c, 0.09), edgeLines(neck, c, 0.7)); break;
      }
      case 'animation': {
        const torusGeo = new THREE.TorusGeometry(0.6, 0.16, 10, 28);
        const torusGrp = new THREE.Group(); torusGrp.add(fillMesh(torusGeo, ORANGE, 0.1), edgeLines(torusGeo, ORANGE, 0.8));
        g.add(torusGrp);
        const sphereGeo = new THREE.SphereGeometry(0.3, 16, 12);
        const sphereGrp = new THREE.Group(); sphereGrp.position.set(0.85, 0.32, 0.15);
        sphereGrp.add(fillMesh(sphereGeo, BLUE, 0.1), edgeLines(sphereGeo, BLUE, 0.8));
        g.add(sphereGrp);
        g.userData.spin = { torusGrp, sphereGrp };
        break;
      }
      default: { const geo = new THREE.IcosahedronGeometry(0.9, 0); g.add(fillMesh(geo, c, 0.08), edgeLines(geo, c)); }
    }
    return g;
  }
  function disposeGroup(obj) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose());
    });
  }
  function start(canvas, shape, accent) {
    stop();
    if (!canvas || typeof THREE === 'undefined') return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene.add(new THREE.AmbientLight(0x40465a, 1.2));
    const l1 = new THREE.PointLight(ORANGE, 1.3, 12); l1.position.set(2.5, 2, 3);
    const l2 = new THREE.PointLight(BLUE, 1.0, 12); l2.position.set(-2.5, -1.5, -3);
    scene.add(l1, l2);
    group = buildShape(shape, accent);
    scene.add(group);
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false; controls.enableZoom = false;
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = 2.2;
    resize();
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      controls.update();
      if (group.userData.spin) {
        group.userData.spin.torusGrp.rotation.x += 0.006;
        group.userData.spin.sphereGrp.rotation.y += 0.014;
      }
      renderer.render(scene, camera);
    };
    loop();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!renderer || !renderer.domElement) return;
    const w = renderer.domElement.clientWidth || 1, h = renderer.domElement.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function update(shape, accent) {
    if (!scene || !group) return;
    scene.remove(group);
    disposeGroup(group);
    group = buildShape(shape, accent);
    scene.add(group);
  }
  /* Swaps the preview to show a real uploaded .glb instead of the
     procedural placeholder shape. */
  function loadModel(url) {
    return new Promise((resolve, reject) => {
      if (!scene || typeof THREE.GLTFLoader === 'undefined') { reject(new Error('preview not ready')); return; }
      const loader = new THREE.GLTFLoader();
      loader.load(url, gltf => {
        const model = gltf.scene || gltf.scenes[0];
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(1.7 / maxDim);
        if (scene && group) { scene.remove(group); disposeGroup(group); }
        group = model;
        if (scene) {
          scene.add(group);
          const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 5);
          const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, 1, -3);
          scene.add(key, fill);
        }
        resolve();
      }, undefined, err => reject(err));
    });
  }
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    if (group) disposeGroup(group);
    if (renderer) renderer.dispose();
    renderer = scene = camera = controls = group = null;
  }
  return { start, update, stop, loadModel };
})();

/* =========================================================
   AUTH — real Supabase accounts, role gated
   ========================================================= */
const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');
const bootLoading = document.getElementById('bootLoading');

function hideBootLoading() {
  bootLoading.classList.add('is-hidden');
}

async function showApp() {
  loginScreen.classList.add('is-hidden');
  appEl.classList.remove('is-hidden');
  hideBootLoading();
  await loadDB();
  await renderAll();
  switchView('dashboard');
}
function showLogin() {
  appEl.classList.add('is-hidden');
  loginScreen.classList.remove('is-hidden');
  hideBootLoading();
}
function goToPublicSite() {
  window.location.href = '../index.html';
}

/* Boot-time access check */
(async function checkAccess() {
  try {
    const account = await window.AetherData.getCurrentAccount();
    if (!account) { showLogin(); return; }
    if (account.role !== 'admin') {
      // Stale non-admin session from a previous visit — sign out so the
      // person can try a different account instead of getting silently
      // bounced away with no way back to the login form.
      await window.AetherData.signOut();
      showLogin();
      toast('Sesi sebelumnya bukan akun admin, silakan login ulang.');
      return;
    }
    await showApp();
  } catch (err) {
    console.error('checkAccess failed', err);
    showLogin();
  }
})();

/* ----- Login form ----- */
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Email dan password wajib diisi.'; return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await window.AetherData.signIn({ email, password: pass });
    const account = await window.AetherData.getCurrentAccount();
    if (!account) {
      errEl.textContent = 'Akun ditemukan tapi profil belum siap, coba lagi sesaat lagi.';
      submitBtn.disabled = false;
      return;
    }
    if (account.role !== 'admin') {
      toast('Akun ini bukan admin — mengalihkan ke situs utama...');
      setTimeout(goToPublicSite, 900);
      return;
    }
    await showApp();
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('confirm')) {
      errEl.textContent = 'Email belum dikonfirmasi. Cek email kamu, atau minta admin konfirmasi manual lewat SQL Editor.';
    } else if (msg.includes('invalid login credentials')) {
      errEl.textContent = 'Email atau password salah — atau akun belum dikonfirmasi (cek Supabase Auth settings).';
    } else {
      errEl.textContent = 'Gagal login: ' + (err.message || 'terjadi kesalahan.');
    }
    submitBtn.disabled = false;
  }
});

/* ----- Register form ----- */
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;
  const pass2 = document.getElementById('regPassword2').value;
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';

  if (!name || !email || !pass) { errEl.textContent = 'Semua field wajib diisi.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Password minimal 6 karakter.'; return; }
  if (pass !== pass2) { errEl.textContent = 'Konfirmasi password tidak cocok.'; return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const result = await window.AetherData.signUp({ name, email, password: pass });
    if (!result.session) {
      // Email confirmation is required before this account can sign in.
      toast('Akun dibuat! Cek email kamu untuk konfirmasi sebelum bisa login.');
      document.getElementById('toLoginBtn').click();
      submitBtn.disabled = false;
      return;
    }
    toast('Akun dibuat — kamu bukan admin, mengalihkan ke situs utama...');
    setTimeout(goToPublicSite, 1000);
  } catch (err) {
    errEl.textContent = err.message && err.message.includes('already') ? 'Email ini sudah terdaftar.' : 'Gagal membuat akun, coba lagi.';
    submitBtn.disabled = false;
  }
});

/* ----- Login/Register toggle ----- */
const authHeading = document.getElementById('authHeading');
const authDesc = document.getElementById('authDesc');
document.getElementById('toRegisterBtn').addEventListener('click', () => {
  document.getElementById('loginForm').classList.add('is-hidden');
  document.getElementById('registerForm').classList.remove('is-hidden');
  document.getElementById('toRegisterText').classList.add('is-hidden');
  document.getElementById('toLoginText').classList.remove('is-hidden');
  authHeading.textContent = 'Buat Akun Baru';
  authDesc.textContent = 'Akun baru dibuat dengan role "user" secara default.';
});
document.getElementById('toLoginBtn').addEventListener('click', () => {
  document.getElementById('registerForm').classList.add('is-hidden');
  document.getElementById('loginForm').classList.remove('is-hidden');
  document.getElementById('toLoginText').classList.add('is-hidden');
  document.getElementById('toRegisterText').classList.remove('is-hidden');
  authHeading.textContent = 'Masuk ke Dashboard';
  authDesc.textContent = 'Panel admin untuk mengelola konten portofolio 3D.';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await window.AetherData.signOut();
  showLogin();
});

/* =========================================================
   VIEW ROUTER + SIDEBAR
   ========================================================= */
const VIEW_TITLES = {
  dashboard: 'Dashboard', portfolio: 'Portofolio', categories: 'Kategori',
  services: 'Layanan', skills: 'Skills', testimonials: 'Testimoni',
  inbox: 'Pesan Masuk', activity: 'Log Aktivitas', accounts: 'Manajemen Akun',
  settings: 'Pengaturan Situs', profile: 'Profil Admin', news: 'Berita'
};

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === name));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('is-active', n.dataset.view === name));
  document.getElementById('topbarTitle').textContent = VIEW_TITLES[name] || name;
  closeSidebarMobile();
  document.querySelector('.view-scroll').scrollTop = 0;

  // lazy-load admin-only views that aren't part of the shared content DB
  if (name === 'inbox') renderInbox();
  if (name === 'activity') renderActivityLog();
  if (name === 'accounts') renderAccounts();
  if (name === 'settings') startHeroModelPreview();
  else AdminPreview3D.stop(); // free the GPU context when leaving settings
}

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.goto));
});

/* Mobile sidebar */
const sidebar = document.getElementById('sidebar');
const appOverlay = document.getElementById('appOverlay');
function openSidebarMobile() { sidebar.classList.add('is-open'); appOverlay.classList.add('is-open'); }
function closeSidebarMobile() { sidebar.classList.remove('is-open'); appOverlay.classList.remove('is-open'); }
document.getElementById('sidebarToggle').addEventListener('click', openSidebarMobile);
appOverlay.addEventListener('click', closeSidebarMobile);

/* =========================================================
   RENDER: DASHBOARD
   ========================================================= */
async function renderDashboard() {
  document.getElementById('statProjects').textContent = DB.projects.length;

  const messages = await window.AetherData.loadMessages();
  const unread = messages.filter(m => !m.read).length;
  document.getElementById('statMessages').textContent = unread;

  document.getElementById('statTestimonials').textContent = DB.testimonials.length;
  const avg = DB.testimonials.length
    ? (DB.testimonials.reduce((s, t) => s + t.rating, 0) / DB.testimonials.length).toFixed(1)
    : '0.0';
  document.getElementById('statRating').textContent = avg;

  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const heights = [42, 58, 51, 70, 65, 90, 76];
  document.getElementById('visitsChart').innerHTML = heights.map((h, i) => `
    <div class="bar-col">
      <div class="bar-fill" style="height:${h}%"></div>
      <div class="bar-label">${days[i]}</div>
    </div>`).join('');

  const recentMsgs = [...messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  document.getElementById('dashRecentMessages').innerHTML = recentMsgs.map(m => `
    <div class="mini-item">
      <span class="mini-dot ${m.read ? 'dot-blue' : 'dot-orange'}"></span>
      <div>
        <div class="mini-item-title">${escapeHtml(m.name)}</div>
        <div class="mini-item-sub">${escapeHtml(m.subject)}</div>
      </div>
      <span class="mini-item-time">${timeAgo(m.created_at)}</span>
    </div>`).join('') || '<div class="mini-item-sub">Belum ada pesan.</div>';

  const activity = await window.AetherData.loadActivity();
  document.getElementById('dashRecentActivity').innerHTML = activity.slice(0, 5).map(a => `
    <div class="mini-item">
      <span class="mini-dot dot-orange"></span>
      <div><div class="mini-item-title">${escapeHtml(a.text)}</div></div>
      <span class="mini-item-time">${timeAgo(a.created_at)}</span>
    </div>`).join('') || '<div class="mini-item-sub">Belum ada aktivitas.</div>';
}

/* =========================================================
   RENDER + CRUD: PORTFOLIO
   ========================================================= */
function categoryOptions(selected) {
  return DB.categories.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === selected ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}
function refreshPortfolioFilterOptions() {
  const sel = document.getElementById('portFilterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="All">Semua Kategori</option>' + categoryOptions(null);
  sel.value = [...sel.options].some(o => o.value === current) ? current : 'All';
}
function renderPortfolio() {
  refreshPortfolioFilterOptions();
  const catFilter = document.getElementById('portFilterCategory').value;
  const statusFilter = document.getElementById('portFilterStatus').value;

  const rows = DB.projects.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    (statusFilter === 'All' || p.status === statusFilter)
  );

  const tbody = document.getElementById('portfolioTableBody');
  tbody.innerHTML = rows.map(p => `
    <tr data-id="${p.id}">
      <td><span class="swatch" style="background:${p.accent === 'blue' ? 'linear-gradient(135deg,#3AA6FF,#1a5c8f)' : 'linear-gradient(135deg,#F5792A,#7a3200)'}"></span></td>
      <td>
        <div class="row-title">${escapeHtml(p.title)}</div>
        <div class="row-sub">${escapeHtml(p.description || '')}</div>
      </td>
      <td><span class="tag tag-blue">${escapeHtml(p.category)}</span></td>
      <td class="row-sub">${escapeHtml(p.tools || '—')}</td>
      <td><span class="status-pill status-${p.status}"><span class="status-dot"></span>${p.status === 'published' ? 'Published' : 'Draft'}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-project" data-id="${p.id}" title="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete-project" data-id="${p.id}" title="Hapus">🗑</button>
        </div>
      </td>
    </tr>`).join('');
  document.getElementById('portfolioEmpty').classList.toggle('is-visible', rows.length === 0);
}

function projectFormHtml(p) {
  p = p || { title: '', category: DB.categories[0]?.name || '', tools: '', description: '', status: 'draft', accent: 'orange', shape: 'icosahedron', model_url: '' };
  return `
    <div class="shape-preview-box">
      <canvas id="shapePreviewCanvas"></canvas>
      <div class="shape-preview-hint">⟲ drag untuk lihat model 3D</div>
    </div>
    <label class="field"><span class="field-label">Model 3D Asli (.glb) — opsional</span>
      <div class="model-upload-box">
        <div class="model-upload-status" id="modelUploadStatus">${p.model_url ? '✓ Model tersimpan' : 'Belum ada model diunggah'}</div>
        <input type="file" id="fModelInput" accept=".glb" class="file-input">
        <div class="model-upload-actions">
          <label for="fModelInput" class="btn-secondary btn-sm">Unggah .glb</label>
          <button type="button" class="btn-ghost-sm" id="removeModelBtn" style="${p.model_url ? '' : 'display:none'}">Hapus Model</button>
        </div>
      </div>
      <input type="hidden" id="fModelUrl" value="${p.model_url || ''}">
    </label>
    <label class="field"><span class="field-label">Judul Proyek</span><input id="fTitle" type="text" value="${escapeHtml(p.title)}" required></label>
    <div class="form-row">
      <label class="field"><span class="field-label">Kategori</span><select id="fCategory">${categoryOptions(p.category)}</select></label>
      <label class="field"><span class="field-label">Status</span>
        <select id="fStatus">
          <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${p.status === 'published' ? 'selected' : ''}>Published</option>
        </select>
      </label>
    </div>
    <label class="field"><span class="field-label">Bentuk Placeholder (dipakai kalau belum ada model asli di atas)</span>
      <select id="fShape">
        <option value="torusknot" ${p.shape === 'torusknot' ? 'selected' : ''}>Torus Knot (Produk)</option>
        <option value="icosahedron" ${p.shape === 'icosahedron' ? 'selected' : ''}>Icosahedron (Modeling)</option>
        <option value="arch" ${p.shape === 'arch' ? 'selected' : ''}>Kotak Blueprint (Arsitektur)</option>
        <option value="villa" ${p.shape === 'villa' ? 'selected' : ''}>Rumah/Villa (Arsitektur)</option>
        <option value="bottle" ${p.shape === 'bottle' ? 'selected' : ''}>Botol (Produk)</option>
        <option value="animation" ${p.shape === 'animation' ? 'selected' : ''}>Dua Objek Berputar (Animasi)</option>
      </select>
    </label>
    <label class="field"><span class="field-label">Tools (pisahkan koma)</span><input id="fTools" type="text" value="${escapeHtml(p.tools)}"></label>
    <label class="field"><span class="field-label">Deskripsi</span><textarea id="fDesc" rows="3">${escapeHtml(p.description)}</textarea></label>
    <label class="field"><span class="field-label">Warna Aksen Thumbnail</span>
      <div class="color-swatch-picker">
        <span class="color-swatch-opt ${p.accent === 'orange' ? 'is-selected' : ''}" data-accent="orange" style="background:#F5792A"></span>
        <span class="color-swatch-opt ${p.accent === 'blue' ? 'is-selected' : ''}" data-accent="blue" style="background:#3AA6FF"></span>
      </div>
      <input type="hidden" id="fAccent" value="${p.accent}">
    </label>
    <div class="modal-actions">
      <button type="button" class="btn-secondary btn-sm" id="cancelBtn">Batal</button>
      <button type="submit" class="btn-primary">Simpan Proyek</button>
    </div>`;
}
function openProjectModal(existing) {
  openModal(existing ? 'Edit Proyek' : 'Tambah Proyek Baru', `<form id="projectForm">${projectFormHtml(existing)}</form>`);
  const form = document.getElementById('projectForm');

  AdminPreview3D.start(document.getElementById('shapePreviewCanvas'), existing ? existing.shape : 'icosahedron', existing ? existing.accent : 'orange');
  if (existing && existing.model_url) {
    AdminPreview3D.loadModel(existing.model_url).catch(() => toast('Model tersimpan gagal dimuat ulang di preview.'));
  }

  form.querySelectorAll('.color-swatch-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      form.querySelectorAll('.color-swatch-opt').forEach(o => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      document.getElementById('fAccent').value = opt.dataset.accent;
      if (!document.getElementById('fModelUrl').value) AdminPreview3D.update(document.getElementById('fShape').value, opt.dataset.accent);
    });
  });
  document.getElementById('fShape').addEventListener('change', e => {
    if (!document.getElementById('fModelUrl').value) AdminPreview3D.update(e.target.value, document.getElementById('fAccent').value);
  });

  const modelInput = document.getElementById('fModelInput');
  const modelStatus = document.getElementById('modelUploadStatus');
  const removeModelBtn = document.getElementById('removeModelBtn');
  modelInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) { toast('Hanya file .glb yang didukung.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast('File cukup besar (>15MB) — mungkin lambat dimuat pengunjung. Tetap lanjut mengunggah.'); }
    modelStatus.textContent = 'Mengunggah...';
    try {
      const url = await window.AetherData.uploadModel(file);
      document.getElementById('fModelUrl').value = url;
      modelStatus.textContent = '✓ Model tersimpan: ' + file.name;
      removeModelBtn.style.display = '';
      await AdminPreview3D.loadModel(url);
    } catch (err) {
      console.error('uploadModel failed', err);
      const detail = (err && err.message) || 'kesalahan tidak diketahui';
      modelStatus.textContent = 'Gagal mengunggah model: ' + detail;
      toast('Gagal mengunggah model 3D: ' + detail);
    }
  });
  removeModelBtn.addEventListener('click', () => {
    document.getElementById('fModelUrl').value = '';
    modelStatus.textContent = 'Belum ada model diunggah';
    removeModelBtn.style.display = 'none';
    modelInput.value = '';
    AdminPreview3D.update(document.getElementById('fShape').value, document.getElementById('fAccent').value);
  });

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const data = {
      title: document.getElementById('fTitle').value.trim() || 'Untitled Project',
      category: document.getElementById('fCategory').value,
      status: document.getElementById('fStatus').value,
      shape: document.getElementById('fShape').value,
      tools: document.getElementById('fTools').value.trim(),
      description: document.getElementById('fDesc').value.trim(),
      accent: document.getElementById('fAccent').value,
      model_url: document.getElementById('fModelUrl').value || null,
    };
    try {
      if (existing) {
        await window.AetherData.updateProject(existing.id, data);
        logActivity('◧', `Mengedit proyek "${data.title}"`);
        toast('Proyek diperbarui ✓');
      } else {
        await window.AetherData.addProject(data);
        logActivity('◧', `Menambahkan proyek "${data.title}"`);
        toast('Proyek ditambahkan ✓');
      }
      await loadDB();
      closeModal();
      renderPortfolio();
      renderDashboard();
    } catch (err) {
      toast('Gagal menyimpan proyek.');
      submitBtn.disabled = false;
    }
  });
}
document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));
document.getElementById('portFilterCategory').addEventListener('change', renderPortfolio);
document.getElementById('portFilterStatus').addEventListener('change', renderPortfolio);
document.getElementById('portfolioTableBody').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const proj = DB.projects.find(p => p.id === btn.dataset.id);
  if (!proj) return;
  if (btn.dataset.action === 'edit-project') openProjectModal(proj);
  if (btn.dataset.action === 'delete-project') {
    if (confirm(`Hapus proyek "${proj.title}"?`)) {
      await window.AetherData.deleteProject(proj.id);
      logActivity('🗑', `Menghapus proyek "${proj.title}"`);
      await loadDB();
      renderPortfolio();
      renderDashboard();
      toast('Proyek dihapus ✓');
    }
  }
});

/* =========================================================
   RENDER + CRUD: CATEGORIES
   ========================================================= */
function renderCategories() {
  const el = document.getElementById('categoryList');
  el.innerHTML = DB.categories.map(c => `
    <div class="chip" data-id="${c.id}">
      <span>${escapeHtml(c.name)}</span>
      <button class="edit-chip" data-action="edit-category" data-id="${c.id}" title="Edit">✎</button>
      <button data-action="delete-category" data-id="${c.id}" title="Hapus">×</button>
    </div>`).join('') || '<div class="row-sub">Belum ada kategori.</div>';
}
document.getElementById('addCategoryBtn').addEventListener('click', async () => {
  const name = prompt('Nama kategori baru:');
  if (name && name.trim()) {
    try {
      await window.AetherData.addCategory(name.trim());
      logActivity('◱', `Menambahkan kategori "${name.trim()}"`);
      await loadDB();
      renderCategories();
    } catch (err) { toast('Gagal menambah kategori (mungkin sudah ada).'); }
  }
});
document.getElementById('categoryList').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const cat = DB.categories.find(c => c.id === btn.dataset.id);
  if (!cat) return;
  if (btn.dataset.action === 'edit-category') {
    const name = prompt('Edit nama kategori:', cat.name);
    if (name && name.trim()) {
      await window.AetherData.updateCategory(cat.id, name.trim());
      await loadDB();
      renderCategories();
      renderPortfolio();
      toast('Kategori diperbarui ✓');
    }
  }
  if (btn.dataset.action === 'delete-category') {
    if (confirm(`Hapus kategori "${cat.name}"?`)) {
      await window.AetherData.deleteCategory(cat.id);
      logActivity('🗑', `Menghapus kategori "${cat.name}"`);
      await loadDB();
      renderCategories();
      renderPortfolio();
      toast('Kategori dihapus ✓');
    }
  }
});

/* =========================================================
   RENDER + CRUD: SERVICES
   ========================================================= */
function renderServices() {
  const el = document.getElementById('servicesGrid');
  el.innerHTML = DB.services.map(s => `
    <div class="item-card" data-id="${s.id}">
      <div class="item-card-actions">
        <button class="icon-btn" data-action="edit-service" data-id="${s.id}">✎</button>
        <button class="icon-btn danger" data-action="delete-service" data-id="${s.id}">🗑</button>
      </div>
      <div class="item-card-icon">${escapeHtml(s.icon)}</div>
      <div class="item-card-title">${escapeHtml(s.title)}</div>
      <div class="item-card-desc">${escapeHtml(s.description)}</div>
    </div>`).join('') || '<div class="row-sub">Belum ada layanan.</div>';
}
function serviceFormHtml(s) {
  s = s || { icon: '◧', title: '', description: '' };
  return `
    <div class="form-row">
      <label class="field"><span class="field-label">Ikon (emoji/simbol)</span><input id="fIcon" type="text" value="${escapeHtml(s.icon)}" maxlength="4"></label>
      <label class="field"><span class="field-label">Judul Layanan</span><input id="fSTitle" type="text" value="${escapeHtml(s.title)}" required></label>
    </div>
    <label class="field"><span class="field-label">Deskripsi</span><textarea id="fSDesc" rows="3">${escapeHtml(s.description)}</textarea></label>
    <div class="modal-actions">
      <button type="button" class="btn-secondary btn-sm" id="cancelBtn">Batal</button>
      <button type="submit" class="btn-primary">Simpan Layanan</button>
    </div>`;
}
function openServiceModal(existing) {
  openModal(existing ? 'Edit Layanan' : 'Tambah Layanan', `<form id="serviceForm">${serviceFormHtml(existing)}</form>`);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('serviceForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      icon: document.getElementById('fIcon').value.trim() || '◧',
      title: document.getElementById('fSTitle').value.trim() || 'Layanan Baru',
      description: document.getElementById('fSDesc').value.trim(),
    };
    if (existing) { await window.AetherData.updateService(existing.id, data); logActivity('◈', `Mengedit layanan "${data.title}"`); toast('Layanan diperbarui ✓'); }
    else { await window.AetherData.addService(data); logActivity('◈', `Menambahkan layanan "${data.title}"`); toast('Layanan ditambahkan ✓'); }
    await loadDB(); closeModal(); renderServices();
  });
}
document.getElementById('addServiceBtn').addEventListener('click', () => openServiceModal(null));
document.getElementById('servicesGrid').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const s = DB.services.find(x => x.id === btn.dataset.id);
  if (!s) return;
  if (btn.dataset.action === 'edit-service') openServiceModal(s);
  if (btn.dataset.action === 'delete-service') {
    if (confirm(`Hapus layanan "${s.title}"?`)) {
      await window.AetherData.deleteService(s.id);
      logActivity('🗑', `Menghapus layanan "${s.title}"`);
      await loadDB(); renderServices(); toast('Layanan dihapus ✓');
    }
  }
});

/* =========================================================
   RENDER + CRUD: SKILLS
   ========================================================= */
function renderSkills() {
  const el = document.getElementById('skillList');
  el.innerHTML = DB.skills.map(sk => `
    <div class="skill-row" data-id="${sk.id}">
      <div class="skill-row-name">${escapeHtml(sk.name)}</div>
      <div class="skill-row-bar"><div class="skill-row-fill" style="width:${sk.pct}%"></div></div>
      <input type="range" min="0" max="100" value="${sk.pct}" data-action="slide-skill" data-id="${sk.id}">
      <div class="skill-row-pct">${sk.pct}%</div>
      <div class="skill-row-actions">
        <button class="icon-btn danger" data-action="delete-skill" data-id="${sk.id}" title="Hapus">🗑</button>
      </div>
    </div>`).join('') || '<div class="row-sub">Belum ada skill.</div>';
}
document.getElementById('addSkillBtn').addEventListener('click', async () => {
  const name = prompt('Nama skill baru:');
  if (name && name.trim()) {
    await window.AetherData.addSkill(name.trim(), 50);
    logActivity('◫', `Menambahkan skill "${name.trim()}"`);
    await loadDB();
    renderSkills();
  }
});
document.getElementById('skillList').addEventListener('input', e => {
  if (e.target.dataset.action === 'slide-skill') {
    const sk = DB.skills.find(s => s.id === e.target.dataset.id);
    if (sk) {
      sk.pct = Number(e.target.value);
      const row = e.target.closest('.skill-row');
      row.querySelector('.skill-row-fill').style.width = sk.pct + '%';
      row.querySelector('.skill-row-pct').textContent = sk.pct + '%';
    }
  }
});
document.getElementById('skillList').addEventListener('change', async e => {
  if (e.target.dataset.action === 'slide-skill') {
    await window.AetherData.updateSkillPct(e.target.dataset.id, Number(e.target.value));
  }
});
document.getElementById('skillList').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action="delete-skill"]');
  if (!btn) return;
  const sk = DB.skills.find(s => s.id === btn.dataset.id);
  if (sk && confirm(`Hapus skill "${sk.name}"?`)) {
    await window.AetherData.deleteSkill(sk.id);
    logActivity('🗑', `Menghapus skill "${sk.name}"`);
    await loadDB(); renderSkills(); toast('Skill dihapus ✓');
  }
});

/* =========================================================
   RENDER + CRUD: TESTIMONIALS
   ========================================================= */
function renderTestimonials() {
  const el = document.getElementById('testimonialsGrid');
  el.innerHTML = DB.testimonials.map(t => `
    <div class="item-card" data-id="${t.id}">
      <div class="item-card-actions">
        <button class="icon-btn" data-action="edit-testi" data-id="${t.id}">✎</button>
        <button class="icon-btn danger" data-action="delete-testi" data-id="${t.id}">🗑</button>
      </div>
      <div class="item-card-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
      <div class="item-card-quote">"${escapeHtml(t.quote)}"</div>
      <div class="item-card-person">${escapeHtml(t.name)}</div>
      <div class="item-card-role">${escapeHtml(t.role)}</div>
    </div>`).join('') || '<div class="row-sub">Belum ada testimoni.</div>';
}
function testimonialFormHtml(t) {
  t = t || { name: '', role: '', quote: '', rating: 5 };
  const stars = [1, 2, 3, 4, 5].map(n => `<span class="rating-star ${n <= t.rating ? 'is-active' : ''}" data-star="${n}">★</span>`).join('');
  return `
    <div class="form-row">
      <label class="field"><span class="field-label">Nama Klien</span><input id="fTName" type="text" value="${escapeHtml(t.name)}" required></label>
      <label class="field"><span class="field-label">Peran / Perusahaan</span><input id="fTRole" type="text" value="${escapeHtml(t.role)}"></label>
    </div>
    <label class="field"><span class="field-label">Isi Testimoni</span><textarea id="fTText" rows="3">${escapeHtml(t.quote)}</textarea></label>
    <label class="field"><span class="field-label">Rating</span><div class="rating-picker" id="ratingPicker">${stars}</div><input type="hidden" id="fTRating" value="${t.rating}"></label>
    <div class="modal-actions">
      <button type="button" class="btn-secondary btn-sm" id="cancelBtn">Batal</button>
      <button type="submit" class="btn-primary">Simpan Testimoni</button>
    </div>`;
}
function openTestimonialModal(existing) {
  openModal(existing ? 'Edit Testimoni' : 'Tambah Testimoni', `<form id="testiForm">${testimonialFormHtml(existing)}</form>`);
  const picker = document.getElementById('ratingPicker');
  picker.addEventListener('click', e => {
    const star = e.target.closest('.rating-star');
    if (!star) return;
    const val = Number(star.dataset.star);
    document.getElementById('fTRating').value = val;
    picker.querySelectorAll('.rating-star').forEach(s => s.classList.toggle('is-active', Number(s.dataset.star) <= val));
  });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('testiForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('fTName').value.trim() || 'Klien',
      role: document.getElementById('fTRole').value.trim(),
      quote: document.getElementById('fTText').value.trim(),
      rating: Number(document.getElementById('fTRating').value) || 5,
    };
    if (existing) { await window.AetherData.updateTestimonial(existing.id, data); logActivity('❝', `Mengedit testimoni "${data.name}"`); toast('Testimoni diperbarui ✓'); }
    else { await window.AetherData.addTestimonial(data); logActivity('❝', `Menambahkan testimoni dari "${data.name}"`); toast('Testimoni ditambahkan ✓'); }
    await loadDB(); closeModal(); renderTestimonials(); renderDashboard();
  });
}
document.getElementById('addTestimonialBtn').addEventListener('click', () => openTestimonialModal(null));
document.getElementById('testimonialsGrid').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const t = DB.testimonials.find(x => x.id === btn.dataset.id);
  if (!t) return;
  if (btn.dataset.action === 'edit-testi') openTestimonialModal(t);
  if (btn.dataset.action === 'delete-testi') {
    if (confirm(`Hapus testimoni dari "${t.name}"?`)) {
      await window.AetherData.deleteTestimonial(t.id);
      logActivity('🗑', `Menghapus testimoni dari "${t.name}"`);
      await loadDB(); renderTestimonials(); renderDashboard(); toast('Testimoni dihapus ✓');
    }
  }
});

/* =========================================================
   RENDER + CRUD: NEWS (with real image upload to Storage)
   ========================================================= */

/* Resizes + compresses an uploaded image client-side, returning a Blob
   ready to upload to Supabase Storage. */
function compressImageToBlob(file, maxWidth = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderNews() {
  const catFilter = document.getElementById('newsFilterCategory').value;
  const statusFilter = document.getElementById('newsFilterStatus').value;
  const rows = (DB.news || []).filter(n =>
    (catFilter === 'All' || n.category === catFilter) &&
    (statusFilter === 'All' || n.status === statusFilter)
  ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const tbody = document.getElementById('newsTableBody');
  tbody.innerHTML = rows.map(n => `
    <tr data-id="${n.id}">
      <td>${n.image_url
        ? `<img src="${n.image_url}" class="swatch" style="object-fit:cover">`
        : `<span class="swatch" style="background:${n.accent === 'blue' ? 'linear-gradient(135deg,#3AA6FF,#1a5c8f)' : 'linear-gradient(135deg,#F5792A,#7a3200)'}"></span>`}</td>
      <td>
        <div class="row-title">${escapeHtml(n.title)}</div>
        <div class="row-sub">${escapeHtml(n.excerpt)}</div>
      </td>
      <td><span class="tag tag-blue">${escapeHtml(n.category)}</span></td>
      <td><span class="status-pill status-${n.status}"><span class="status-dot"></span>${n.status === 'published' ? 'Published' : 'Draft'}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-news" data-id="${n.id}" title="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete-news" data-id="${n.id}" title="Hapus">🗑</button>
        </div>
      </td>
    </tr>`).join('');
  document.getElementById('newsEmpty').classList.toggle('is-visible', rows.length === 0);
}

function newsFormHtml(n) {
  n = n || { title: '', category: 'Update Proyek', excerpt: '', content: '', accent: 'orange', status: 'draft', image_url: '', created_at: null };
  const dateValue = n.created_at ? new Date(n.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `
    <label class="field"><span class="field-label">Gambar Artikel (opsional, sebagai bukti/dokumentasi)</span>
      <div class="news-image-upload">
        <img id="newsImagePreview" src="${n.image_url || ''}" class="${n.image_url ? '' : 'is-hidden'}">
        <div class="news-image-placeholder" id="newsImagePlaceholder" style="${n.image_url ? 'display:none' : ''}">Belum ada gambar</div>
        <input type="file" id="fNImageInput" accept="image/*" class="file-input">
        <div class="news-image-actions">
          <label for="fNImageInput" class="btn-secondary btn-sm">Unggah Gambar</label>
          <button type="button" class="btn-ghost-sm" id="removeNewsImageBtn" style="${n.image_url ? '' : 'display:none'}">Hapus Gambar</button>
        </div>
      </div>
    </label>
    <label class="field"><span class="field-label">Judul Artikel</span><input id="fNTitle" type="text" value="${escapeHtml(n.title)}" required></label>
    <div class="form-row">
      <label class="field"><span class="field-label">Kategori</span>
        <select id="fNCategory">
          <option value="Update Proyek" ${n.category === 'Update Proyek' ? 'selected' : ''}>Update Proyek</option>
          <option value="Tutorial" ${n.category === 'Tutorial' ? 'selected' : ''}>Tutorial</option>
          <option value="Pengumuman" ${n.category === 'Pengumuman' ? 'selected' : ''}>Pengumuman</option>
        </select>
      </label>
      <label class="field"><span class="field-label">Status</span>
        <select id="fNStatus">
          <option value="draft" ${n.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${n.status === 'published' ? 'selected' : ''}>Published</option>
        </select>
      </label>
    </div>
    <label class="field"><span class="field-label">Tanggal Publikasi</span><input id="fNDate" type="date" value="${dateValue}" required></label>
    <label class="field"><span class="field-label">Ringkasan Singkat</span><textarea id="fNExcerpt" rows="2">${escapeHtml(n.excerpt)}</textarea></label>
    <label class="field"><span class="field-label">Isi Artikel (pisahkan paragraf dengan baris baru)</span><textarea id="fNContent" rows="7">${escapeHtml(n.content)}</textarea></label>
    <label class="field"><span class="field-label">Warna Aksen (dipakai kalau tanpa gambar)</span>
      <div class="color-swatch-picker">
        <span class="color-swatch-opt ${n.accent === 'orange' ? 'is-selected' : ''}" data-accent="orange" style="background:#F5792A"></span>
        <span class="color-swatch-opt ${n.accent === 'blue' ? 'is-selected' : ''}" data-accent="blue" style="background:#3AA6FF"></span>
      </div>
      <input type="hidden" id="fNAccent" value="${n.accent}">
    </label>
    <div class="modal-actions">
      <button type="button" class="btn-secondary btn-sm" id="cancelBtn">Batal</button>
      <button type="submit" class="btn-primary">Simpan Artikel</button>
    </div>`;
}
function openNewsModal(existing) {
  openModal(existing ? 'Edit Artikel' : 'Tulis Artikel Baru', `<form id="newsForm">${newsFormHtml(existing)}</form>`);
  const form = document.getElementById('newsForm');

  form.querySelectorAll('.color-swatch-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      form.querySelectorAll('.color-swatch-opt').forEach(o => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      document.getElementById('fNAccent').value = opt.dataset.accent;
    });
  });

  let pendingImageBlob = null;
  let imageRemoved = false;
  const currentImageUrl = existing ? existing.image_url : null;

  const imgInput = document.getElementById('fNImageInput');
  const imgPreview = document.getElementById('newsImagePreview');
  const imgPlaceholder = document.getElementById('newsImagePlaceholder');
  const removeBtn = document.getElementById('removeNewsImageBtn');

  imgInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingImageBlob = await compressImageToBlob(file);
      imageRemoved = false;
      imgPreview.src = URL.createObjectURL(pendingImageBlob);
      imgPreview.classList.remove('is-hidden');
      imgPlaceholder.style.display = 'none';
      removeBtn.style.display = '';
    } catch (err) {
      toast('Gagal memuat gambar, coba file lain.');
    }
  });
  removeBtn.addEventListener('click', () => {
    pendingImageBlob = null;
    imageRemoved = true;
    imgPreview.src = '';
    imgPreview.classList.add('is-hidden');
    imgPlaceholder.style.display = '';
    removeBtn.style.display = 'none';
    imgInput.value = '';
  });

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
      let image_url = imageRemoved ? null : currentImageUrl;
      if (pendingImageBlob) {
        image_url = await window.AetherData.uploadNewsImage(pendingImageBlob);
      }
      const dateInput = document.getElementById('fNDate').value;
      const data = {
        title: document.getElementById('fNTitle').value.trim() || 'Untitled Article',
        category: document.getElementById('fNCategory').value,
        status: document.getElementById('fNStatus').value,
        excerpt: document.getElementById('fNExcerpt').value.trim(),
        content: document.getElementById('fNContent').value,
        accent: document.getElementById('fNAccent').value,
        image_url,
        // Fixed at noon so the chosen calendar date can't shift a day
        // backward/forward due to timezone conversion at midnight.
        created_at: new Date(dateInput + 'T12:00:00').toISOString(),
      };
      if (existing) {
        await window.AetherData.updateNews(existing.id, data);
        logActivity('📰', `Mengedit artikel "${data.title}"`);
        toast('Artikel diperbarui ✓');
      } else {
        await window.AetherData.addNews(data);
        logActivity('📰', `Menulis artikel baru "${data.title}"`);
        toast('Artikel ditambahkan ✓');
      }
      await loadDB();
      closeModal();
      renderNews();
    } catch (err) {
      toast('Gagal menyimpan artikel.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Simpan Artikel';
    }
  });
}
document.getElementById('addNewsBtn').addEventListener('click', () => openNewsModal(null));
document.getElementById('newsFilterCategory').addEventListener('change', renderNews);
document.getElementById('newsFilterStatus').addEventListener('change', renderNews);
document.getElementById('newsTableBody').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const article = (DB.news || []).find(n => n.id === btn.dataset.id);
  if (!article) return;
  if (btn.dataset.action === 'edit-news') openNewsModal(article);
  if (btn.dataset.action === 'delete-news') {
    if (confirm(`Hapus artikel "${article.title}"?`)) {
      await window.AetherData.deleteNews(article.id);
      logActivity('🗑', `Menghapus artikel "${article.title}"`);
      await loadDB();
      renderNews();
      toast('Artikel dihapus ✓');
    }
  }
});

/* =========================================================
   RENDER + ACTIONS: INBOX (live from Supabase)
   ========================================================= */
async function updateInboxBadges() {
  const messages = await window.AetherData.loadMessages();
  const unread = messages.filter(m => !m.read).length;
  [document.getElementById('inboxBadge'), document.getElementById('bellBadge')].forEach(b => {
    b.textContent = unread;
    b.dataset.zero = unread === 0 ? 'true' : 'false';
  });
  return messages;
}
async function renderInbox() {
  const messages = await updateInboxBadges();
  const list = [...messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const el = document.getElementById('inboxList');
  el.innerHTML = list.map(m => `
    <div class="inbox-item ${m.read ? 'is-read' : 'is-unread'}" data-id="${m.id}">
      <span class="inbox-unread-dot"></span>
      <div class="inbox-item-body">
        <div class="inbox-item-top">
          <span class="inbox-item-name">${escapeHtml(m.name)} <span class="row-sub">— ${escapeHtml(m.email)}</span></span>
          <span class="inbox-item-time">${timeAgo(m.created_at)}</span>
        </div>
        <div class="inbox-item-subject">${escapeHtml(m.subject)}</div>
        <div class="inbox-item-preview">${escapeHtml(m.body)}</div>
      </div>
      <div class="inbox-item-actions">
        <button class="icon-btn danger" data-action="delete-msg" data-id="${m.id}" title="Hapus">🗑</button>
      </div>
    </div>`).join('');
  document.getElementById('inboxEmpty').classList.toggle('is-visible', list.length === 0);
}
document.getElementById('inboxList').addEventListener('click', async e => {
  const delBtn = e.target.closest('button[data-action="delete-msg"]');
  if (delBtn) {
    if (confirm('Hapus pesan ini?')) {
      await window.AetherData.deleteMessage(delBtn.dataset.id);
      await renderInbox();
      renderDashboard();
      toast('Pesan dihapus ✓');
    }
    return;
  }
  const item = e.target.closest('.inbox-item');
  if (!item) return;
  const messages = await window.AetherData.loadMessages();
  const msg = messages.find(m => m.id === item.dataset.id);
  if (!msg) return;
  if (!msg.read) { await window.AetherData.markMessageRead(msg.id, true); await renderInbox(); renderDashboard(); }
  openModal('Detail Pesan', `
    <div class="msg-detail-meta">
      <div>
        <div class="msg-detail-name">${escapeHtml(msg.name)}</div>
        <div class="msg-detail-email">${escapeHtml(msg.email)}</div>
      </div>
      <div class="msg-detail-time">${timeAgo(msg.created_at)}</div>
    </div>
    <div class="msg-detail-subject">${escapeHtml(msg.subject)}</div>
    <div class="msg-detail-body">${escapeHtml(msg.body)}</div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary btn-sm" id="cancelBtn">Tutup</button>
    </div>`);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
});
document.getElementById('bellBtn').addEventListener('click', () => switchView('inbox'));
document.getElementById('topbarProfile').addEventListener('click', () => switchView('profile'));

/* =========================================================
   RENDER: ACTIVITY LOG (live from Supabase)
   ========================================================= */
async function renderActivityLog() {
  const activity = await window.AetherData.loadActivity();
  const el = document.getElementById('activityTimeline');
  el.innerHTML = activity.map(a => `
    <div class="timeline-item">
      <div class="timeline-dot">${escapeHtml(a.icon || '•')}</div>
      <div>
        <div class="timeline-text">${escapeHtml(a.text)}</div>
        <div class="timeline-time">${timeAgo(a.created_at)}</div>
      </div>
    </div>`).join('') || '<div class="row-sub">Belum ada aktivitas.</div>';
}

/* =========================================================
   RENDER + CRUD: ACCOUNTS (real Supabase Auth + profiles)
   ========================================================= */
async function renderAccounts() {
  const accounts = await window.AetherData.loadAccounts();
  const me = await window.AetherData.getCurrentAccount();
  const tbody = document.getElementById('accountsTableBody');
  tbody.innerHTML = accounts.map(a => `
    <tr data-id="${a.id}">
      <td class="row-title">${escapeHtml(a.name)}${me && me.id === a.id ? ' <span class="row-sub">(kamu)</span>' : ''}</td>
      <td class="row-sub">${escapeHtml(a.email)}</td>
      <td><span class="role-badge role-${a.role}">${a.role}</span></td>
      <td class="row-sub">${timeAgo(a.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="toggle-role" data-id="${a.id}" title="Ganti role">⇄</button>
          <button class="icon-btn danger" data-action="delete-account" data-id="${a.id}" title="Cabut akses">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}
document.getElementById('accountsTableBody').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const accounts = await window.AetherData.loadAccounts();
  const acc = accounts.find(a => a.id === btn.dataset.id);
  if (!acc) return;
  const me = await window.AetherData.getCurrentAccount();
  const admins = accounts.filter(a => a.role === 'admin');

  if (btn.dataset.action === 'toggle-role') {
    if (acc.role === 'admin' && admins.length <= 1) { toast('Tidak bisa mengubah role — minimal harus ada 1 akun admin.'); return; }
    const newRole = acc.role === 'admin' ? 'user' : 'admin';
    await window.AetherData.setAccountRole(acc.id, newRole);
    logActivity('◍', `Mengubah role "${acc.name}" menjadi ${newRole}`);
    await renderAccounts();
    toast(`Role diubah menjadi ${newRole} ✓`);
    return;
  }
  if (btn.dataset.action === 'delete-account') {
    if (me && me.id === acc.id) { toast('Kamu tidak bisa mencabut akses akunmu sendiri saat sedang login.'); return; }
    if (acc.role === 'admin' && admins.length <= 1) { toast('Tidak bisa — minimal harus ada 1 akun admin.'); return; }
    if (confirm(`Cabut akses admin untuk "${acc.name}"? (login Supabase-nya tetap ada, tapi tidak lagi punya role di sistem ini)`)) {
      await window.AetherData.revokeAccount(acc.id);
      logActivity('🗑', `Mencabut akses akun "${acc.name}"`);
      await renderAccounts();
      toast('Akses akun dicabut ✓');
    }
  }
});

/* =========================================================
   SETTINGS FORM
   ========================================================= */
function fillSettingsForm() {
  const s = DB.settings || {};
  document.getElementById('setBadge').value = s.badge || '';
  document.getElementById('setHeadline').value = s.headline || '';
  document.getElementById('setSub').value = s.sub || '';
  document.getElementById('setBio').value = s.bio || '';
  document.getElementById('setArtstation').value = s.artstation || '';
  document.getElementById('setInstagram').value = s.instagram || '';
  document.getElementById('setLinkedin').value = s.linkedin || '';
  document.getElementById('setSeoTitle').value = s.seo_title || '';
  document.getElementById('setSeoDesc').value = s.seo_desc || '';
  document.getElementById('setHeroModelUrl').value = s.hero_model_url || '';
  document.getElementById('heroModelStatus').textContent = s.hero_model_url ? '✓ Model tersimpan' : 'Belum ada model diunggah — Hero pakai bentuk gem default';
  document.getElementById('removeHeroModelBtn').style.display = s.hero_model_url ? '' : 'none';
}

function startHeroModelPreview() {
  const canvas = document.getElementById('heroModelPreviewCanvas');
  const url = document.getElementById('setHeroModelUrl').value;
  AdminPreview3D.start(canvas, 'icosahedron', 'orange');
  if (url) AdminPreview3D.loadModel(url).catch(() => toast('Model Hero gagal dimuat ulang di preview.'));
}

document.getElementById('fHeroModelInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) { toast('Hanya file .glb yang didukung.'); return; }
  if (file.size > 15 * 1024 * 1024) { toast('File cukup besar (>15MB) — mungkin lambat dimuat pengunjung. Tetap lanjut mengunggah.'); }
  const statusEl = document.getElementById('heroModelStatus');
  statusEl.textContent = 'Mengunggah...';
  try {
    const url = await window.AetherData.uploadModel(file);
    document.getElementById('setHeroModelUrl').value = url;
    statusEl.textContent = '✓ Model tersimpan: ' + file.name + ' (klik "Simpan Pengaturan" untuk menerapkan)';
    document.getElementById('removeHeroModelBtn').style.display = '';
    await AdminPreview3D.loadModel(url);
  } catch (err) {
    console.error('uploadModel (hero) failed', err);
    const detail = (err && err.message) || 'kesalahan tidak diketahui';
    statusEl.textContent = 'Gagal mengunggah model: ' + detail;
    toast('Gagal mengunggah model Hero: ' + detail);
  }
});
document.getElementById('removeHeroModelBtn').addEventListener('click', () => {
  document.getElementById('setHeroModelUrl').value = '';
  document.getElementById('heroModelStatus').textContent = 'Model dihapus (klik "Simpan Pengaturan" untuk menerapkan)';
  document.getElementById('removeHeroModelBtn').style.display = 'none';
  document.getElementById('fHeroModelInput').value = '';
  AdminPreview3D.update('icosahedron', 'orange');
});

document.getElementById('settingsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    badge: document.getElementById('setBadge').value,
    headline: document.getElementById('setHeadline').value,
    sub: document.getElementById('setSub').value,
    bio: document.getElementById('setBio').value,
    artstation: document.getElementById('setArtstation').value,
    instagram: document.getElementById('setInstagram').value,
    linkedin: document.getElementById('setLinkedin').value,
    seo_title: document.getElementById('setSeoTitle').value,
    seo_desc: document.getElementById('setSeoDesc').value,
    hero_model_url: document.getElementById('setHeroModelUrl').value || null,
  };
  try {
    await window.AetherData.updateSettings(data);
    logActivity('⚙', 'Memperbarui pengaturan situs');
    await loadDB();
    const conf = document.getElementById('settingsSaved');
    conf.classList.add('is-visible');
    setTimeout(() => conf.classList.remove('is-visible'), 2000);
    toast('Pengaturan disimpan ✓');
  } catch (err) {
    toast('Gagal menyimpan pengaturan.');
  }
});

/* =========================================================
   PROFILE FORM (with real avatar upload to Storage)
   ========================================================= */
async function fillProfileForm() {
  const me = await window.AetherData.getCurrentAccount();
  if (!me) return;
  document.getElementById('profName').value = me.name;
  document.getElementById('profEmail').value = me.email;
  const avatar = me.avatar_url || 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#F5792A"/><text x="50%" y="54%" font-family="DM Sans" font-size="46" fill="#0D0F14" text-anchor="middle" dominant-baseline="middle" font-weight="700">${(me.name || '?').charAt(0).toUpperCase()}</text></svg>`);
  document.getElementById('profileAvatarPreview').src = avatar;
  document.getElementById('topbarAvatar').src = avatar;
  document.getElementById('topbarName').textContent = me.name;
}
document.getElementById('avatarInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const blob = await compressImageToBlob(file, 400, 0.85);
    const url = await window.AetherData.uploadAvatar(blob);
    const me = await window.AetherData.getCurrentAccount();
    await window.AetherData.updateProfile(me.id, { avatar_url: url });
    await fillProfileForm();
    toast('Foto profil diperbarui ✓');
  } catch (err) {
    toast('Gagal mengunggah foto.');
  }
});
document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('profileError');
  errEl.textContent = '';
  const pass1 = document.getElementById('profPass1').value;
  const pass2 = document.getElementById('profPass2').value;
  if (pass1 || pass2) {
    if (pass1.length < 6) { errEl.textContent = 'Password minimal 6 karakter.'; return; }
    if (pass1 !== pass2) { errEl.textContent = 'Konfirmasi password tidak cocok.'; return; }
  }
  try {
    const me = await window.AetherData.getCurrentAccount();
    const name = document.getElementById('profName').value.trim() || me.name;
    await window.AetherData.updateProfile(me.id, { name });
    if (pass1) {
      const { error } = await window.AetherData.supabase.auth.updateUser({ password: pass1 });
      if (error) throw error;
    }
    logActivity('◍', 'Memperbarui profil admin');
    await fillProfileForm();
    document.getElementById('profPass1').value = '';
    document.getElementById('profPass2').value = '';
    const conf = document.getElementById('profileSaved');
    conf.classList.add('is-visible');
    setTimeout(() => conf.classList.remove('is-visible'), 2000);
    toast('Profil disimpan ✓');
  } catch (err) {
    errEl.textContent = 'Gagal menyimpan profil.';
  }
});

/* =========================================================
   RENDER ALL / INIT
   ========================================================= */
async function renderAll() {
  renderPortfolio();
  renderCategories();
  renderServices();
  renderSkills();
  renderTestimonials();
  renderNews();
  fillSettingsForm();
  await fillProfileForm();
  await renderDashboard();
  await updateInboxBadges();
}
