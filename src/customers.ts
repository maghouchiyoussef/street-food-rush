import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Dog, Item } from './kitchen';
import type { LevelDef } from './levels';
import { PRICE } from './levels';
import { outfits, recolorTextures } from './outfits';
import { LAYOUT, type Stage } from './scene';

// Customers: walk in, order, wait (patience), take items, pay and leave.

export interface Order { dog: { k: boolean; m: boolean } | null; soda: boolean }

export interface ServeResult { coins: number; tip: number; done: boolean; perfect: boolean; slot: number }

interface Customer {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  slot: number;
  state: 'enter' | 'wait' | 'leave';
  from: THREE.Vector3; to: THREE.Vector3; walkT: number; walkDur: number;
  patience: number; maxPatience: number;
  order: Order;
  gotDog: boolean; gotSoda: boolean;
  earned: number; perfect: boolean;
  bubble: HTMLDivElement;
  mood: 'ok' | 'happy' | 'angry';
  bobPhase: number;
}

/** A model template (GLB scene + animations) or null for the fallback */
export interface CustomerModel { scene: THREE.Object3D; clips: THREE.AnimationClip[]; height: number }

const SHIRTS = [0x4f8fe0, 0xe0614f, 0x58b368, 0xf0b23a, 0x9b6bd6, 0xef7fb0];

function fallbackCustomer(i: number) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[i % SHIRTS.length], roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xf2c7a5, 0xc68b5e, 0x8d5a3b, 0xe8b48f][i % 4], roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 6, 16), shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin);
  head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.8 }));
  hair.position.y = 1.64;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), eyeMat);
    eye.position.set(s * 0.065, 1.64, 0.17);
    g.add(eye);
  }
  for (const m of [body, head, hair]) { m.castShadow = true; g.add(m); }
  return g;
}

export class Customers {
  list: Customer[] = [];
  private spawnTimer = 0;
  private count = 0;
  private model: CustomerModel | null = null;
  served = 0;
  lost = 0;
  combo = 0;
  private lastDone = -99;
  private time = 0;
  onEvent: (e: 'arrive' | 'angry' | 'leave', c: { slot: number }) => void = () => {};

  constructor(private stage: Stage, private layer: HTMLElement) {}

  private looks: THREE.Material[] = [];
  private order = [0, 1, 2, 3, 4, 5, 6, 7];

  setModel(m: CustomerModel) {
    this.model = m;
    // Free variety: 8 outfits made by recoloring the texture
    let base: THREE.MeshStandardMaterial | null = null;
    m.scene.traverse(o => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (mm?.map && !base) base = mm; });
    const b = base as THREE.MeshStandardMaterial | null;
    if (!b?.map) return;
    const tex = recolorTextures(b.map, outfits(this.order.length));
    this.looks = tex.map((t, i) => { if (i === 0) return b; const c = b.clone(); c.map = t; return c; });
    this.order.sort(() => Math.random() - 0.5);
  }

  reset() {
    for (const c of this.list) { this.stage.scene.remove(c.obj); c.bubble.remove(); }
    this.list = [];
    this.spawnTimer = 1.2;
    this.served = 0; this.lost = 0; this.combo = 0; this.lastDone = -99; this.time = 0;
  }

  private makeOrder(def: LevelDef): Order {
    const pick = () => Math.random() < 0.5;
    const dog = { k: def.sauces.includes('k') && pick(), m: def.sauces.includes('m') && pick() };
    const soda = def.soda && Math.random() < 0.45;
    const sodaOnly = def.soda && Math.random() < 0.12;
    return { dog: sodaOnly ? null : dog, soda: soda || sodaOnly };
  }

  private spawn(def: LevelDef, forceFirst: boolean) {
    const used = new Set(this.list.filter(c => c.state !== 'leave').map(c => c.slot));
    const allowed = def.maxCustomers === 1 ? [1] : def.maxCustomers === 2 ? [0, 2] : [0, 1, 2];
    const free = allowed.filter(s => !used.has(s));
    if (!free.length) return;
    const slot = forceFirst ? free[0] : free[Math.floor(Math.random() * free.length)];
    const i = this.count++;
    let obj: THREE.Object3D, mixer: THREE.AnimationMixer | null = null;
    if (this.model) {
      obj = skeletonClone(this.model.scene);
      const s = (1.75 / this.model.height) * (0.92 + Math.random() * 0.14);
      obj.scale.setScalar(s);
      if (this.model.clips.length) {
        mixer = new THREE.AnimationMixer(obj);
        mixer.clipAction(this.model.clips[0]).play();
      }
      const look = this.looks[this.order[i % this.order.length]];
      if (look) obj.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = look; });
      obj.scale.x *= 0.94 + Math.random() * 0.14;
    } else {
      obj = fallbackCustomer(i);
    }
    obj.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    const side = Math.random() < 0.5 ? -1 : 1;
    const to = new THREE.Vector3(LAYOUT.customers[slot], 0, LAYOUT.customerZ);
    const from = new THREE.Vector3(side * 3.4, 0, LAYOUT.customerZ - 0.9);
    obj.position.copy(from);
    this.stage.scene.add(obj);
    const bubble = document.createElement('div');
    bubble.className = 'bubble hidden';
    this.layer.appendChild(bubble);
    const order = this.makeOrder(def);
    const c: Customer = {
      obj, mixer, slot, state: 'enter', from, to, walkT: 0, walkDur: from.distanceTo(to) / 1.6,
      patience: def.patience, maxPatience: def.patience, order, gotDog: !order.dog, gotSoda: !order.soda,
      earned: 0, perfect: false, bubble, mood: 'ok', bobPhase: Math.random() * 6,
    };
    this.renderBubble(c);
    this.list.push(c);
  }

  private renderBubble(c: Customer) {
    let html = '';
    if (c.order.dog) {
      const sauces = (c.order.dog.k ? '<i class="k"></i>' : '') + (c.order.dog.m ? '<i class="m"></i>' : '');
      html += `<div class="item dog ${c.gotDog ? 'got' : ''}"><span>🌭</span><div class="sauces">${sauces}</div></div>`;
    }
    if (c.order.soda) html += `<div class="item soda ${c.gotSoda ? 'got' : ''}"><span>🥤</span></div>`;
    c.bubble.innerHTML = `<div class="order">${html}</div><div class="patience"><b></b></div>`;
  }

  /** Try to give an item to a waiting customer. Returns the result or null. */
  give(item: Item): ServeResult | null {
    // prefer the most impatient customer whose order matches
    const waiting = this.list.filter(c => c.state === 'wait').sort((a, b) => a.patience - b.patience);
    for (const c of waiting) {
      let coins = 0;
      if (item.kind === 'dog') {
        if (c.gotDog || !c.order.dog || !sameDog(c.order.dog, item.dog)) continue;
        c.gotDog = true;
        coins = PRICE.dog + (item.dog.k ? PRICE.sauce : 0) + (item.dog.m ? PRICE.sauce : 0);
        if (item.dog.quality === 'perfect') { coins += PRICE.perfect; c.perfect = true; }
      } else {
        if (c.gotSoda || !c.order.soda) continue;
        c.gotSoda = true;
        coins = PRICE.soda;
      }
      c.earned += coins;
      const done = c.gotDog && c.gotSoda;
      let tip = 0;
      if (done) {
        const frac = c.patience / c.maxPatience;
        tip = Math.round(c.earned * 0.5 * frac);
        this.combo = this.time - this.lastDone < 7 ? this.combo + 1 : 1;
        this.lastDone = this.time;
        if (this.combo >= 2) tip += this.combo;
        this.served++;
        this.leave(c, 'happy');
      } else this.renderBubble(c);
      return { coins, tip, done, perfect: item.kind === 'dog' && item.dog.quality === 'perfect', slot: c.slot };
    }
    return null;
  }

  private leave(c: Customer, mood: 'happy' | 'angry') {
    c.state = 'leave';
    c.mood = mood;
    c.from = c.obj.position.clone();
    const side = c.slot === 0 ? -1 : c.slot === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    c.to = new THREE.Vector3(side * 3.6, 0, LAYOUT.customerZ - 1);
    c.walkT = 0; c.walkDur = c.from.distanceTo(c.to) / (mood === 'angry' ? 2.2 : 1.6);
    c.bubble.innerHTML = `<div class="emote">${mood === 'happy' ? (c.perfect ? '😍' : '😋') : '😠'}</div>`;
    c.bubble.classList.remove('hidden');
    this.onEvent(mood === 'angry' ? 'angry' : 'leave', c);
  }

  /** World position above a slot (for floating texts) */
  headPos(slot: number) { return new THREE.Vector3(LAYOUT.customers[slot], 1.9, LAYOUT.customerZ); }

  waitingOrders() { return this.list.filter(c => c.state === 'wait').map(c => c.order); }

  update(dt: number, def: LevelDef | null, spawning: boolean, firstLevel: boolean) {
    this.time += dt;
    if (def && spawning) {
      this.spawnTimer -= dt;
      const active = this.list.filter(c => c.state !== 'leave').length;
      if (this.spawnTimer <= 0 && active < def.maxCustomers) {
        this.spawn(def, firstLevel);
        this.spawnTimer = def.spawnEvery * (0.8 + Math.random() * 0.4) * (active === 0 ? 0.4 : 1);
      }
    }
    const cam = this.stage.camera;
    const v = new THREE.Vector3();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.mixer?.update(dt * (c.state === 'wait' ? 0 : c.mood === 'angry' ? 1.4 : 1));
      if (c.state === 'enter' || c.state === 'leave') {
        c.walkT += dt;
        const k = Math.min(1, c.walkT / c.walkDur);
        c.obj.position.lerpVectors(c.from, c.to, k);
        const dir = v.subVectors(c.to, c.from);
        c.obj.rotation.y = Math.atan2(dir.x, dir.z);
        if (!c.mixer) c.obj.position.y = Math.abs(Math.sin(c.walkT * 9)) * 0.05;
        if (k >= 1) {
          if (c.state === 'enter') {
            c.state = 'wait';
            c.bubble.classList.remove('hidden');
            this.onEvent('arrive', c);
          } else {
            this.stage.scene.remove(c.obj);
            c.bubble.remove();
            this.list.splice(i, 1);
            continue;
          }
        }
      } else {
        // turn to face the player, breathe
        c.obj.rotation.y += (0 - c.obj.rotation.y) * Math.min(1, dt * 8);
        c.bobPhase += dt;
        c.obj.position.y = Math.sin(c.bobPhase * 2.2) * 0.008;
        if (spawning) c.patience -= dt * (firstLevel ? 0.6 : 1);
        const frac = Math.max(0, c.patience / c.maxPatience);
        const bar = c.bubble.querySelector<HTMLElement>('.patience b');
        if (bar) {
          bar.style.width = `${frac * 100}%`;
          bar.style.background = frac > 0.5 ? '#4cd964' : frac > 0.25 ? '#ffcc00' : '#ff3b30';
        }
        c.bubble.classList.toggle('shake', frac < 0.2);
        if (c.patience <= 0) { this.lost++; this.combo = 0; this.leave(c, 'angry'); }
      }
      // position the bubble above the head
      v.set(c.obj.position.x, 1.98, c.obj.position.z).project(cam);
      c.bubble.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
    }
  }
}

function sameDog(a: { k: boolean; m: boolean }, b: Dog) { return a.k === b.k && a.m === b.m; }
