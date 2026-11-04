import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buzz, click, coin, ding, fanfare, initAudio, pop, setAudioEnabled, setMusic, setSizzle, squirt } from './audio';
import { Customers } from './customers';
import { applyLang, LANGS, t, type Key } from './i18n';
import { Kitchen, type TapResult } from './kitchen';
import { LEVELS, starsFor, type LevelDef } from './levels';
import { hapticLight, hapticSuccess, minimize, nativeReady } from './native';
import { loadSave, persist, save, type Lang } from './save';
import { createStage } from './scene';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const stage = createStage(canvas);
const kitchen = new Kitchen(stage);
const customers = new Customers(stage, $('bubbles'));

type Mode = 'menu' | 'play' | 'paused' | 'end';
let mode: Mode = 'menu';
let level: LevelDef | null = null;
let timeLeft = 0;
let money = 0;
let endTimer = 0;
let tutorial = false;

// ---------- Assets ----------
const loader = new GLTFLoader();
new THREE.TextureLoader().load('img/nyc.jpg', tex => stage.setBackground(tex));
// Customer models: the first one also gets recolored outfits
const CUSTOMER_MODELS = ['customer.glb'];
CUSTOMER_MODELS.forEach((file, i) => loader.load(`models/${file}`, gltf => {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
  });
  customers.addModel({ scene: gltf.scene, clips: gltf.animations, height: box.max.y - box.min.y }, i === 0);
}, undefined, () => { /* fallback customers are used */ }));

// ---------- Screens ----------
const screens = ['title', 'levels', 'hud', 'pause', 'results', 'settings'];
function show(...ids: string[]) {
  for (const s of screens) $(s).classList.toggle('hidden', !ids.includes(s));
}

function renderLevels() {
  const list = $('level-list');
  list.innerHTML = '';
  LEVELS.forEach((def, i) => {
    const unlocked = i === 0 || (save.stars[LEVELS[i - 1].id] ?? 0) > 0;
    const stars = save.stars[def.id] ?? 0;
    const b = document.createElement('button');
    b.className = 'level-card' + (unlocked ? '' : ' locked');
    b.innerHTML = `<div class="num">${i + 1}</div><div class="lstars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></div>`
      + (unlocked ? '' : '<div class="lock">🔒</div>');
    if (unlocked) b.onclick = () => { click(); startLevel(def); };
    list.appendChild(b);
  });
  $('coins-total').textContent = String(save.coins);
}

function startLevel(def: LevelDef) {
  level = def;
  timeLeft = def.duration;
  money = 0;
  endTimer = 0;
  tutorial = def.id === LEVELS[0].id && !save.tutorialDone;
  kitchen.reset(def.soda);
  customers.reset();
  $('hud-level').textContent = `${t('level')} ${LEVELS.indexOf(def) + 1}`;
  $('hud-goal').textContent = String(def.target);
  updateHud();
  mode = 'play';
  show('hud');
}

function updateHud() {
  $('hud-money').textContent = String(money);
  const s = Math.max(0, Math.ceil(timeLeft));
  $('hud-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('hud-time').classList.toggle('low', s <= 10);
  const frac = level ? Math.min(1, money / (level.target * 1.6)) : 0;
  $('goal-fill').style.width = `${frac * 100}%`;
  const st = level ? starsFor(level, money) : 0;
  document.querySelectorAll<HTMLElement>('#goal-stars i').forEach((el, i) => el.classList.toggle('on', i < st));
}

function finish() {
  if (!level) return;
  mode = 'end';
  setSizzle(0);
  const stars = starsFor(level, money);
  if (stars > 0) fanfare(); else buzz();
  save.coins += money;
  save.stars[level.id] = Math.max(save.stars[level.id] ?? 0, stars);
  save.best[level.id] = Math.max(save.best[level.id] ?? 0, money);
  if (tutorial) save.tutorialDone = true;
  persist();
  $('res-title').textContent = stars > 0 ? t('timeUp') : t('failed');
  $('res-stars').innerHTML = [0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</i>`).join('');
  $('res-money').textContent = String(money);
  $('res-served').textContent = String(customers.served);
  $('res-lost').textContent = String(customers.lost);
  const idx = LEVELS.indexOf(level);
  $('res-next').classList.toggle('hidden', stars === 0 || idx >= LEVELS.length - 1);
  show('results');
  hint(null);
}

// ---------- Floating texts & hints ----------
function floatText(world: THREE.Vector3, text: string, cls = '') {
  const v = world.clone().project(stage.camera);
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  $('bubbles').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

const hintEl = $('hint'), arrowEl = $('arrow');
let hintAnchor: string | null = null;
function hint(key: Key | null, anchor: string | null = null) {
  hintEl.classList.toggle('hidden', !key);
  if (key) hintEl.textContent = t(key);
  hintAnchor = anchor;
  arrowEl.classList.toggle('hidden', !anchor);
}

function tutorialStep() {
  const orders = customers.waitingOrders();
  if (kitchen.hasBurnt()) {
    const i = kitchen.grill.findIndex(g => g && g.t >= 10);
    return hint('t_burnt', `grill${i}`);
  }
  if (!orders.length && !kitchen.cookingCount && !kitchen.hasDog()) return hint(null);
  const plateDog = kitchen.plates.findIndex(p => p?.sausage);
  if (plateDog >= 0) {
    const p = kitchen.plates[plateDog]!;
    const want = orders.find(o => o.dog);
    if (want?.dog?.k && !p.k) return hint('t_sauce', 'ketchup');
    return hint('t_serve', `plate${plateDog}`);
  }
  if (!kitchen.cookingCount) return hint('t_sausage', 'sausages');
  if (!kitchen.hasEmptyBun()) return hint('t_bun', 'buns');
  const cooked = kitchen.grill.findIndex(g => g && g.t >= 4.5 && g.t < 10);
  if (cooked >= 0) return hint('t_cooked', `grill${cooked}`);
  return hint('t_wait');
}

// ---------- Serving ----------
kitchen.serve = item => {
  const r = customers.give(item);
  if (!r) return false;
  const gain = r.coins + r.tip;
  money += gain;
  const head = customers.headPos(r.slot);
  floatText(head, `+${gain}`, 'money');
  if (r.perfect) floatText(head.clone().add(new THREE.Vector3(0, 0.25, 0)), t('perfect'), 'perfect');
  if (r.done && customers.combo >= 2) floatText(head.clone().add(new THREE.Vector3(0, 0.5, 0)), `${t('combo')} x${customers.combo}`, 'combo');
  coin(r.done ? 1.12 : 1);
  if (r.done) hapticSuccess();
  updateHud();
  return true;
};
customers.onEvent = e => {
  if (e === 'arrive') ding();
  if (e === 'angry') buzz();
};

const SOUND: Partial<Record<TapResult, () => void>> = {
  grill: pop, bun: pop, toBun: pop, sauce: squirt, trash: buzz, sodaStart: pop,
};

// ---------- Input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (mode !== 'play') return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, stage.camera);
  const hit = ray.intersectObjects(stage.hits.filter(h => h.userData.hit !== 'soda' || kitchen.sodaEnabled), false)[0];
  if (!hit) return;
  const res = kitchen.tap(hit.object.userData.hit);
  SOUND[res]?.();
  if (res === 'wrong' || res === 'noSlot' || res === 'noBun' || res === 'raw') click();
  if (save.settings.haptics && res !== 'nothing') hapticLight();
});

// ---------- Buttons ----------
const on = (id: string, fn: () => void) => $(id).addEventListener('click', () => { initAudio(); click(); fn(); });
on('btn-play', () => { renderLevels(); show('levels'); setMusic(save.settings.music); });
on('btn-settings', () => { renderSettings(); show('settings'); });
on('levels-back', () => show('title'));
on('btn-pause', () => { if (mode === 'play') { mode = 'paused'; setSizzle(0); show('hud', 'pause'); } });
on('pause-resume', () => { mode = 'play'; show('hud'); });
on('pause-quit', () => { mode = 'menu'; setSizzle(0); kitchen.reset(false); customers.reset(); hint(null); renderLevels(); show('levels'); });
on('res-retry', () => level && startLevel(level));
on('res-next', () => { if (level) startLevel(LEVELS[LEVELS.indexOf(level) + 1]); });
on('res-menu', () => { mode = 'menu'; kitchen.reset(false); customers.reset(); renderLevels(); show('levels'); });
on('settings-back', () => show('title'));

function renderSettings() {
  const toggles: [string, 'sound' | 'music' | 'haptics'][] = [['set-sound', 'sound'], ['set-music', 'music'], ['set-haptics', 'haptics']];
  for (const [id, k] of toggles) {
    const el = $(id);
    el.classList.toggle('on', save.settings[k]);
    el.onclick = () => {
      save.settings[k] = !save.settings[k];
      el.classList.toggle('on', save.settings[k]);
      if (k === 'sound') setAudioEnabled(save.settings.sound);
      if (k === 'music') setMusic(save.settings.music);
      persist();
    };
  }
  const langs = $('set-lang');
  langs.innerHTML = '';
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.className = l.id === save.settings.lang ? 'on' : '';
    b.onclick = () => { save.settings.lang = l.id as Lang; persist(); applyLang(); renderSettings(); };
    langs.appendChild(b);
  }
}

// ---------- Loop ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'play' && level) {
    timeLeft -= dt;
    kitchen.update(dt);
    customers.update(dt, level, timeLeft > 0, tutorial);
    setSizzle(kitchen.cookingCount);
    if (timeLeft <= 0) {
      endTimer += dt;
      if (endTimer > 0.6) finish();
    }
    updateHud();
    if (tutorial) tutorialStep();
  } else if (mode !== 'paused') {
    kitchen.update(dt);
    customers.update(dt, null, false, false);
  }
  if (hintAnchor) {
    const v = kitchen.anchor(hintAnchor).project(stage.camera);
    arrowEl.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
  }
  stage.renderer.render(stage.scene, stage.camera);
}

window.addEventListener('resize', () => stage.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') { mode = 'paused'; setSizzle(0); show('hud', 'pause'); }
});

async function boot() {
  await loadSave();
  applyLang();
  setAudioEnabled(save.settings.sound);
  show('title');
  frame();
  nativeReady(() => {
    if (mode === 'play') { mode = 'paused'; show('hud', 'pause'); }
    else if (!$('levels').classList.contains('hidden') || !$('settings').classList.contains('hidden')) show('title');
    else if (mode === 'menu') minimize();
  });
}
boot();

(window as any).__game = { stage, kitchen, customers, startLevel, LEVELS, save, applyLang, get money() { return money; } };
