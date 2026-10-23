import { $ } from '../utils/dom.js';

let canvas, ctx2d;
const CONFETTI_COLORS = ['#FF6B9D','#FFD93D','#4ECDC4','#9B5DE5','#FF9A3C','#6BCB77','#3DBBFF'];
const particles = [];
const stars = [];
let animating = false;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function setupParticleCanvas() {
  canvas = $('particleCanvas');
  if (!canvas) return;
  ctx2d  = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Estrelas que voam para fora do botão recém-clicado.
 * É o feedback "fisico" do acerto: a estrela sai da resposta e sobe.
 * @param {DOMRect} rect retângulo do botão tocado
 */
export function burstStars(rect) {
  if (!canvas || !rect) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 9; i++) {
    stars.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 5 - 2.5,
      size: Math.random() * 9 + 7,
      color: pick(['#FFD93D', '#FF9A3C', '#FFFFFF', '#FF6B9D']),
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 14,
      life: 1,
    });
  }
  if (!animating) animateParticles();
}

function spawnStar(ctx2d, p) {
  ctx2d.save();
  ctx2d.globalAlpha = Math.max(0, p.life);
  ctx2d.fillStyle = p.color;
  ctx2d.translate(p.x, p.y);
  ctx2d.rotate(p.rot * Math.PI / 180);
  ctx2d.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const a2 = a + Math.PI / 5;
    ctx2d.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
    ctx2d.lineTo(Math.cos(a2) * p.size * 0.45, Math.sin(a2) * p.size * 0.45);
  }
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.restore();
}

export function showConfetti() {
  for (let i = 0; i < 50; i++) {
    setTimeout(() => spawnParticle(), i * 20);
  }
}

export function spawnLevelUpConfetti() {
  for (let i = 0; i < 120; i++) {
    setTimeout(() => spawnParticle(true), i * 15);
  }
}

function spawnParticle(big = false) {
  if (!canvas) return;
  particles.push({
    x: Math.random() * canvas.width,
    y: -10,
    vx: (Math.random()-0.5) * (big?6:4),
    vy: Math.random() * (big?5:3) + 2,
    size: Math.random()*(big?14:10)+4,
    color: pick(CONFETTI_COLORS),
    rot: Math.random()*360,
    rotV: (Math.random()-0.5)*10,
    life: 1,
    decay: Math.random()*0.01+0.008,
  });
  if (!animating) animateParticles();
}

function animateParticles() {
  if ((!particles.length && !stars.length) || !canvas) { animating = false; return; }
  animating = true;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.life -= p.decay;
    if (p.life <= 0 || p.y > canvas.height) { particles.splice(i, 1); continue; }
    ctx2d.save();
    ctx2d.globalAlpha = p.life;
    ctx2d.fillStyle = p.color;
    ctx2d.translate(p.x, p.y);
    ctx2d.rotate(p.rot * Math.PI / 180);
    ctx2d.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.5);
    ctx2d.restore();
  }
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.18;
    s.rot += s.rotV;
    s.life -= 0.022;
    if (s.life <= 0 || s.y > canvas.height) { stars.splice(i, 1); continue; }
    spawnStar(ctx2d, s);
  }
  requestAnimationFrame(animateParticles);
}
