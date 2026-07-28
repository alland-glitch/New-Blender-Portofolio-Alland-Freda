/* =========================================================
   AETHER RENDER LAB — NEWS PAGE
   Reads published articles from Supabase (window.AetherData).
   Handles both the list view and the single-article detail
   view via ?article=<id> in the URL.
   ========================================================= */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const dateFmt = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- CURSOR (same behavior as main site) ---------- */
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

/* ---------- MOBILE NAV (same behavior as main site) ---------- */
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
const navOverlay = document.getElementById('navOverlay');
function openNav() { navLinks.classList.add('is-open'); hamburger.classList.add('is-active'); navOverlay.classList.add('is-open'); }
function closeNav() { navLinks.classList.remove('is-open'); hamburger.classList.remove('is-active'); navOverlay.classList.remove('is-open'); }
if (hamburger) {
  hamburger.addEventListener('click', () => navLinks.classList.contains('is-open') ? closeNav() : openNav());
  navOverlay.addEventListener('click', closeNav);
}

/* ---------- VIEW SWITCHING ---------- */
const listView = document.getElementById('newsListView');
const detailView = document.getElementById('newsDetailView');
const notFoundView = document.getElementById('newsNotFound');

function showList() {
  listView.classList.remove('is-hidden');
  detailView.classList.add('is-hidden');
  notFoundView.classList.add('is-hidden');
}
function showDetail() {
  listView.classList.add('is-hidden');
  detailView.classList.remove('is-hidden');
  notFoundView.classList.add('is-hidden');
}
function showNotFound() {
  listView.classList.add('is-hidden');
  detailView.classList.add('is-hidden');
  notFoundView.classList.remove('is-hidden');
}

/* ---------- LIST VIEW ---------- */
let activeFilter = 'All';

function renderList(db) {
  const published = db.news.filter(n => n.status === 'published').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const categories = [...new Set(published.map(n => n.category))];

  const filterWrap = document.getElementById('newsFilter');
  filterWrap.innerHTML = ['All', ...categories].map(cat => `
    <button class="filter-btn ${cat === activeFilter ? 'active' : ''}" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
  `).join('');
  filterWrap.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderList(db);
    });
  });

  const filtered = activeFilter === 'All' ? published : published.filter(n => n.category === activeFilter);
  const gridWrap = document.getElementById('newsPageGrid');

  if (!filtered.length) {
    gridWrap.innerHTML = '<div class="news-empty">Belum ada artikel di kategori ini.</div>';
    return;
  }

  gridWrap.innerHTML = filtered.map(n => `
    <div class="news-card">
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
}

/* ---------- DETAIL VIEW ---------- */
function renderDetail(db, articleId) {
  const article = db.news.find(n => n.id === articleId && n.status === 'published');
  if (!article) { showNotFound(); return; }

  document.title = article.title + ' | Aether Render Lab';
  document.getElementById('articleTag').textContent = article.category;
  document.getElementById('articleTag').className = 'news-tag accent-' + article.accent;
  document.getElementById('articleDate').textContent = dateFmt(article.created_at);
  document.getElementById('articleTitle').textContent = article.title;

  const imageWrap = document.getElementById('articleImageWrap');
  const bar = document.getElementById('articleBar');
  if (article.image_url) {
    imageWrap.innerHTML = `<img src="${article.image_url}" class="article-image" alt="${escapeHtml(article.title)}">`;
    imageWrap.classList.remove('is-hidden');
    bar.classList.add('is-hidden');
  } else {
    imageWrap.classList.add('is-hidden');
    imageWrap.innerHTML = '';
    bar.classList.remove('is-hidden');
    bar.style.background = article.accent === 'blue' ? 'var(--blue)' : 'var(--orange)';
  }

  const paragraphs = (article.content || '').split('\n').map(p => p.trim()).filter(Boolean);
  document.getElementById('articleBody').innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

  showDetail();
  window.scrollTo(0, 0);
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.AetherData) return;
  try {
    const db = await window.AetherData.loadContentDB();
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');

    if (articleId) {
      renderDetail(db, articleId);
    } else {
      showList();
      renderList(db);
    }
  } catch (err) {
    console.error('Failed to load news from Supabase', err);
  }
});
