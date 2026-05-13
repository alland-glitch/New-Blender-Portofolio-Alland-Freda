// CURSOR
const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
function animCursor() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animCursor);
}
animCursor();
document.querySelectorAll('a,button,.service-card,.port-card').forEach(el => {
  el.addEventListener('mouseenter', () => ring.style.transform = 'translate(-50%,-50%) scale(1.8)');
  el.addEventListener('mouseleave', () => ring.style.transform = 'translate(-50%,-50%) scale(1)');
});

// HERO CANVAS
const canvas = document.getElementById('heroCanvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
resize(); window.addEventListener('resize', resize);

// Grid
const GRID = 60;
// Particles
const particles = Array.from({length: 60}, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 900,
  vx: (Math.random() - 0.5) * 0.4,
  vy: (Math.random() - 0.5) * 0.4,
  r: Math.random() * 1.5 + 0.5,
  alpha: Math.random() * 0.5 + 0.2,
  color: Math.random() > 0.5 ? '#F5792A' : '#3AA6FF'
}));

let t = 0;
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(245,121,42,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += GRID) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += GRID) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Orange glow
  const gx = ctx.createRadialGradient(W*0.15, H*0.5, 0, W*0.15, H*0.5, W*0.5);
  gx.addColorStop(0, 'rgba(245,121,42,0.12)');
  gx.addColorStop(1, 'transparent');
  ctx.fillStyle = gx; ctx.fillRect(0,0,W,H);

  // Blue glow
  const gb = ctx.createRadialGradient(W*0.8, H*0.3, 0, W*0.8, H*0.3, W*0.4);
  gb.addColorStop(0, 'rgba(58,166,255,0.07)');
  gb.addColorStop(1, 'transparent');
  ctx.fillStyle = gb; ctx.fillRect(0,0,W,H);

  // Wireframe hexagons
  ctx.save();
  ctx.translate(W*0.75, H*0.5);
  ctx.rotate(t * 0.003);
  [[180,'rgba(245,121,42,0.08)'], [130,'rgba(58,166,255,0.06)'], [80,'rgba(245,121,42,0.12)']].forEach(([r, c]) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.restore();

  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = p.color.replace(')', `,${p.alpha})`).replace('rgb', 'rgba').replace('#F5792A', `rgba(245,121,42,${p.alpha})`).replace('#3AA6FF', `rgba(58,166,255,${p.alpha})`);
    ctx.fill();
  });

  t++;
  requestAnimationFrame(draw);
}
draw();

// REVEAL ON SCROLL
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
reveals.forEach(el => io.observe(el));

// SKILL BARS
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

// PORTFOLIO FILTER
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// FORM SUBMIT
function handleSubmit(btn) {
  btn.textContent = 'Message Sent! ✓';
  btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
  setTimeout(() => {
    btn.textContent = 'Send Project Brief →';
    btn.style.background = '';
  }, 3000);
}

// HAMBURGER
document.getElementById('hamburger').addEventListener('click', () => {
  const links = document.querySelector('.nav-links');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  links.style.flexDirection = 'column';
  links.style.position = 'absolute';
  links.style.top = '68px';
  links.style.left = '0'; links.style.right = '0';
  links.style.background = 'var(--bg)';
  links.style.padding = '20px';
  links.style.borderBottom = '1px solid var(--border)';
});

// SMOOTH SCROLL + CLOSE MOBILE NAV
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    const links = document.querySelector('.nav-links');
    if (window.innerWidth < 769) links.style.display = 'none';
  });
});