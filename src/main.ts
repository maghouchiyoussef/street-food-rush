import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buzz, click, coin, ding, fanfare, initAudio, meow, pop, setAudioEnabled, setMusic, setSizzle, squirt } from './audio';
import { Cat } from './cat';
import { CITIES, cityOf, type City } from './cities';
import { Customers } from './customers';
import { applyLang, LANGS, t, type Key } from './i18n';
import { Kitchen, type TapResult } from './kitchen';
import { LEVELS, PER_CITY, starsFor, type LevelDef } from './levels';
import { buy, claimDaily, effects, level as upLevel, UPGRADES } from './shop';
import { hapticLight, hapticSuccess, minimize, nativeReady } from './native';
import { loadSave, persist, save, type Lang } from './save';
import { createStage } from './scene';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const stage = createStage(canvas);
const kitchen = new Kitchen(stage);
const customers = new Customers(stage, $('bubbles'));
const cat = new Cat(stage, kitchen);

type Mode = 'menu' | 'play' | 'paused' | 'end';
let mode: Mode = 'menu';
let level: LevelDef | null = null;
let timeLeft = 0;
let money = 0;
let endTimer = 0;
let tutorial = false;

// ---------- Assets ----------
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const bgCache = new Map<string, THREE.Texture>();
function useCity(city: City) {
  stage.setCity(city);
  kitchen.city = city;
  customers.city = city;
  const cached = bgCache.get(city.id);
  if (cached) stage.setBackground(cached);
  else texLoader.load(city.bg, tex => { bgCache.set(city.id, tex); if (kitchen.city === city) stage.setBackground(tex); });
}
useCity(CITIES[0]);
// Customer models: the first one also gets recolored outfits
// [file, real height in meters] — kids and grandmas are shorter than the counter regulars
const CUSTOMER_MODELS: [string, number][] = [
  ['customer.glb', 1.75], ['customer3.glb', 1.74], ['customer4.glb', 1.6],
  ['customer5.glb', 1.66], ['customer6.glb', 1.72], ['customer7.glb', 1.56],
];
CUSTOMER_MODELS.forEach(([file, tall], i) => loader.load(`models/${file}`, gltf => {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
  });
  customers.addModel({ scene: gltf.scene, clips: gltf.animations, height: box.max.y - box.min.y, tall }, i === 0);
}, undefined, () => { /* fallback customers are used */ }));

// ---------- Screens ----------
const screens = ['title', 'world', 'levels', 'shop', 'hud', 'pause', 'results', 'settings'];
function show(...ids: string[]) {
  for (const s of screens) $(s).classList.toggle('hidden', !ids.includes(s));
}

const unlockedIdx = (i: number) => i === 0 || (save.stars[LEVELS[i - 1].id] ?? 0) > 0;
const cityStars = (id: string) => LEVELS.filter(l => l.city === id).reduce((n, l) => n + (save.stars[l.id] ?? 0), 0);
let currentCity: City = CITIES[0];

function renderWorld() {
  const list = $('city-list');
  list.innerHTML = '';
  CITIES.forEach((city, ci) => {
    const first = LEVELS[ci * PER_CITY];
    const open = unlockedIdx(first.index);
    const b = document.createElement('button');
    b.className = 'city-card' + (open ? '' : ' locked');
    b.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(43,24,64,.85)), url(${city.bg})`;
    b.innerHTML = `<div class="cflag">${open ? city.flag + ' ' + city.dish : '🔒'}</div><div class="cname">${city.name[save.settings.lang]}</div>`
      + `<div class="cstars">★ ${cityStars(city.id)} / ${PER_CITY * 3}</div>`;
    if (open) b.onclick = () => { click(); currentCity = city; useCity(city); renderLevels(); show('levels'); };
    list.appendChild(b);
  });
  $('coins-world').textContent = String(save.coins);
}

function renderLevels() {
  const list = $('level-list');
  list.innerHTML = '';
  $('levels-city').textContent = `${currentCity.flag} ${currentCity.name[save.settings.lang]}`;
  LEVELS.filter(l => l.city === currentCity.id).forEach(def => {
    const unlocked = unlockedIdx(def.index);
    const stars = save.stars[def.id] ?? 0;
    const b = document.createElement('button');
    b.className = 'level-card' + (unlocked ? '' : ' locked');
    b.innerHTML = `<div class="num">${def.n}</div><div class="lstars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></div>`
      + (unlocked ? '' : '<div class="lock">🔒</div>');
    if (unlocked) b.onclick = () => { click(); startLevel(def); };
    list.appendChild(b);
  });
  $('coins-total').textContent = String(save.coins);
}

function renderShop() {
  const list = $('shop-list');
  list.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = upLevel(u.id);
    const max = lv >= u.cost.length;
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<div class="sicon">${u.icon}</div><div class="sinfo"><b>${t(`up_${u.id}` as Key)}</b><small>${t(`upd_${u.id}` as Key)}</small>`
      + `<div class="pips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn small' + (max ? '' : save.coins >= u.cost[lv] ? ' green' : ' off');
    btn.textContent = max ? t('max') : `🪙 ${u.cost[lv]}`;
    if (!max) btn.onclick = () => { if (buy(u)) { coin(1.2); persist(); renderShop(); } else buzz(); };
    row.appendChild(btn);
    list.appendChild(row);
  }
  $('coins-shop').textContent = String(save.coins);
}

function startLevel(def: LevelDef) {
  level = def;
  timeLeft = def.duration;
  money = 0;
  endTimer = 0;
  tutorial = def.id === LEVELS[0].id && !save.tutorialDone;
  currentCity = cityOf(def.city);
  useCity(currentCity);
  const fx = effects();
  kitchen.cookSpeed = fx.cookSpeed;
  customers.fx = { patience: fx.patience, tips: fx.tips, bonus: fx.bonus };
  kitchen.reset(def.soda, currentCity);
  customers.reset();
  cat.reset(def.index >= 3);
  $('hud-level').textContent = `${currentCity.flag} ${currentCity.name[save.settings.lang]} · ${t('level')} ${def.n}`;
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
cat.onSteal = () => { meow(0.7); floatText(cat.obj.position.clone().add(new THREE.Vector3(0, 0.4, 0)), '😼', 'combo'); };
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
  if (hit.object.userData.hit === 'cat') {
    if (cat.shoo()) {
      meow();
      money += 2;
      floatText(cat.obj.position.clone().add(new THREE.Vector3(0, 0.4, 0)), `${t('shoo')} +2`, 'combo');
      updateHud();
    }
    return;
  }
  const res = kitchen.tap(hit.object.userData.hit);
  SOUND[res]?.();
  if (res === 'wrong' || res === 'noSlot' || res === 'noBun' || res === 'raw') click();
  if (save.settings.haptics && res !== 'nothing') hapticLight();
});

// ---------- Buttons ----------
const on = (id: string, fn: () => void) => $(id).addEventListener('click', () => { initAudio(); click(); fn(); });
on('btn-play', () => { renderWorld(); show('world'); setMusic(save.settings.music); });
on('world-back', () => show('title'));
on('world-shop', () => { renderShop(); show('shop'); });
on('shop-back', () => { renderWorld(); show('world'); });
on('btn-settings', () => { renderSettings(); show('settings'); });
on('levels-back', () => { renderWorld(); show('world'); });
on('btn-pause', () => { if (mode === 'play') { mode = 'paused'; setSizzle(0); show('hud', 'pause'); } });
on('pause-resume', () => { mode = 'play'; show('hud'); });
on('pause-quit', () => { mode = 'menu'; setSizzle(0); kitchen.reset(false); customers.reset(); hint(null); renderLevels(); show('levels'); });
on('res-retry', () => level && startLevel(level));
on('res-next', () => { if (level) startLevel(LEVELS[LEVELS.indexOf(level) + 1]); });
on('res-menu', () => { mode = 'menu'; kitchen.reset(false); customers.reset(); renderLevels(); show('levels'); });
on('settings-back', () => show('title'));
on('daily-ok', () => { coin(1.3); $('daily').classList.add('hidden'); });

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
    cat.update(dt);
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
  const daily = claimDaily();
  if (daily.coins) {
    persist();
    $('daily-coins').textContent = `+${daily.coins}`;
    $('daily-streak').textContent = `${t('streak')}: ${daily.streak} 🔥`;
    $('daily').classList.remove('hidden');
  }
  const visible = (id: string) => !$(id).classList.contains('hidden');
  nativeReady(() => {
    if (mode === 'play') { mode = 'paused'; setSizzle(0); show('hud', 'pause'); }
    else if (visible('levels') || visible('shop')) { renderWorld(); show('world'); }
    else if (visible('world') || visible('settings')) show('title');
    else if (mode === 'menu') minimize();
  });
}
boot();

(window as any).__game = { stage, kitchen, customers, cat, startLevel, LEVELS, CITIES, save, applyLang, renderWorld, renderShop, show, get money() { return money; } };
