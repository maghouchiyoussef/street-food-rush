import * as THREE from 'three';
import { CITIES, type City } from './cities';
import { baseItem, cookMain, cup, mainItem, sauceLine, tray } from './food';
import { COUNTER_Y, LAYOUT, type Stage } from './scene';

// The cooking stations: grill (3 slots), plates (2), sauces, soda machine.

export const COOK_AT = 4.5;     // seconds until golden
export const PERFECT_FOR = 2.2; // golden + shiny window
export const BURN_AT = 10;      // seconds until burnt
const SODA_TIME = 2.2;

export type Quality = 'perfect' | 'ok';
export interface Dog { k: boolean; m: boolean; quality: Quality }
export type Item = { kind: 'dog'; dog: Dog } | { kind: 'soda' };

interface GrillItem { mesh: THREE.Mesh; t: number }
interface Plate { group: THREE.Group; sausage: THREE.Mesh | null; quality: Quality | null; k: boolean; m: boolean }
interface Cup { group: THREE.Group; fill: number }

export type TapResult =
  | 'grill' | 'bun' | 'toBun' | 'sauce' | 'served' | 'trash' | 'sodaStart'
  | 'noSlot' | 'raw' | 'noBun' | 'noDog' | 'wrong' | 'busy' | 'nothing';

/** Small bounce animation queue */
const bounces: { obj: THREE.Object3D; t: number; base: number }[] = [];
export function bounce(obj: THREE.Object3D) {
  const ex = bounces.find(b => b.obj === obj);
  if (ex) { ex.t = 0; return; }
  bounces.push({ obj, t: 0, base: obj.scale.y });
}

/** Flying item animation (from a position to another, then callback) */
const flights: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; done?: () => void }[] = [];
function fly(obj: THREE.Object3D, to: THREE.Vector3, dur = 0.28, arc = 0.25, done?: () => void) {
  flights.push({ obj, from: obj.position.clone(), to, t: 0, dur, arc, done });
}

export class Kitchen {
  grill: (GrillItem | null)[] = [null, null, null];
  plates: (Plate | null)[] = [null, null];
  cup: Cup | null = null;
  selected = -1;
  sodaEnabled = false;
  city: City = CITIES[0];
  /** upgrades: cook speed multiplier and number of grill slots / plates in use */
  cookSpeed = 1;
  grillSlots = 3;
  /** Called to hand an item to a customer; returns true if someone took it */
  serve: (item: Item) => boolean = () => false;
  private smoke: THREE.Sprite[] = [];
  private smokeTex: THREE.Texture;

  constructor(private stage: Stage) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    this.smokeTex = new THREE.CanvasTexture(c);
  }

  reset(soda: boolean, city: City = this.city) {
    this.city = city;
    for (const gi of this.grill) if (gi) this.stage.scene.remove(gi.mesh);
    for (const p of this.plates) if (p) this.stage.scene.remove(p.group);
    if (this.cup) this.stage.scene.remove(this.cup.group);
    this.grill = Array(this.grillSlots).fill(null);
    this.plates = [null, null];
    this.cup = null;
    this.selected = -1;
    this.sodaEnabled = soda;
    this.stage.sodaMachine.visible = soda;
    for (const s of this.smoke) this.stage.scene.remove(s);
    this.smoke = [];
  }

  get cookingCount() { return this.grill.filter(Boolean).length; }
  hasBurnt() { return this.grill.some(g => g && g.t >= BURN_AT); }
  hasCooked() { return this.grill.some(g => g && g.t >= COOK_AT && g.t < BURN_AT); }
  hasEmptyBun() { return this.plates.some(p => p && !p.sausage); }
  hasDog() { return this.plates.some(p => p?.sausage); }

  tap(id: string): TapResult {
    if (id === 'sausages') {
      const i = this.grill.indexOf(null);
      if (i < 0) return 'noSlot';
      const m = mainItem(this.city.main, this.city.mainColors);
      m.position.set(LAYOUT.sausageBox[0], COUNTER_Y + 0.1, LAYOUT.sausageBox[1]);
      this.stage.scene.add(m);
      const [x, z] = LAYOUT.grillSlots[i];
      fly(m, new THREE.Vector3(x, COUNTER_Y + 0.105, z));
      this.grill[i] = { mesh: m, t: 0 };
      return 'grill';
    }
    if (id === 'buns') {
      const i = this.plates.indexOf(null);
      if (i < 0) return 'noSlot';
      const [x, z] = LAYOUT.plates[i];
      const group = new THREE.Group();
      group.position.set(x, COUNTER_Y, z);
      const tr = tray();
      const [b, topY] = baseItem(this.city.base);
      b.position.y = 0.03;
      group.add(tr, b);
      group.userData.topY = topY + 0.03;
      group.scale.setScalar(1.25);
      this.stage.scene.add(group);
      bounce(group);
      this.plates[i] = { group, sausage: null, quality: null, k: false, m: false };
      return 'bun';
    }
    if (id.startsWith('grill')) {
      const i = +id.slice(5);
      const gi = this.grill[i];
      if (!gi) return 'nothing';
      if (gi.t >= BURN_AT) {
        this.grill[i] = null;
        fly(gi.mesh, gi.mesh.position.clone().add(new THREE.Vector3(1.2, -0.6, 0.8)), 0.35, 0.3, () => this.stage.scene.remove(gi.mesh));
        return 'trash';
      }
      if (gi.t < COOK_AT) { bounce(gi.mesh); return 'raw'; }
      const p = this.plates.findIndex(pl => pl && !pl.sausage);
      if (p < 0) { bounce(gi.mesh); return 'noBun'; }
      const plate = this.plates[p]!;
      this.grill[i] = null;
      const quality: Quality = gi.t < COOK_AT + PERFECT_FOR ? 'perfect' : 'ok';
      plate.quality = quality;
      plate.sausage = gi.mesh;
      // re-parent into the plate group (local coordinates)
      const world = gi.mesh.position.clone();
      this.stage.scene.remove(gi.mesh);
      plate.group.add(gi.mesh);
      gi.mesh.position.copy(plate.group.worldToLocal(world));
      gi.mesh.scale.setScalar(1 / plate.group.scale.x * 1.1);
      fly(gi.mesh, new THREE.Vector3(0, plate.group.userData.topY ?? 0.075, 0), 0.25, 0.2, () => bounce(plate.group));
      (gi.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0);
      this.selected = p;
      return 'toBun';
    }
    if (id === 'ketchup' || id === 'mustard') {
      const key = id === 'ketchup' ? 'k' : 'm';
      bounce(id === 'ketchup' ? this.stage.ketchup : this.stage.mustard);
      let p = this.selected;
      if (!(p >= 0 && this.plates[p]?.sausage && !this.plates[p]![key])) {
        p = this.plates.findIndex(pl => pl?.sausage && !pl[key]);
      }
      if (p < 0) return 'noDog';
      const plate = this.plates[p]!;
      plate[key] = true;
      const line = sauceLine(this.city.sauces[key === 'k' ? 0 : 1], key === 'k' ? 0 : 1.6);
      line.position.set(0, (plate.group.userData.topY ?? 0.075) + (this.city.main === 'crepe' ? 0.015 : this.city.main === 'strip' ? 0.03 : 0.05) + (key === 'm' && plate.k ? 0.01 : 0) + (key === 'k' && plate.m ? 0.01 : 0), 0);
      line.scale.set(1.1, 1, 1);
      plate.group.add(line);
      bounce(plate.group);
      this.selected = p;
      return 'sauce';
    }
    if (id.startsWith('plate')) {
      const i = +id.slice(5);
      const plate = this.plates[i];
      if (!plate) return 'nothing';
      if (!plate.sausage) { bounce(plate.group); return 'noDog'; }
      const ok = this.serve({ kind: 'dog', dog: { k: plate.k, m: plate.m, quality: plate.quality! } });
      if (!ok) { this.selected = i; bounce(plate.group); return 'wrong'; }
      this.plates[i] = null;
      fly(plate.group, plate.group.position.clone().add(new THREE.Vector3(0, 0.3, -0.9)), 0.3, 0.3, () => this.stage.scene.remove(plate.group));
      if (this.selected === i) this.selected = -1;
      return 'served';
    }
    if (id === 'soda') {
      if (!this.sodaEnabled) return 'nothing';
      if (!this.cup) {
        const group = cup(this.city.drinkColor);
        group.position.set(LAYOUT.soda[0], COUNTER_Y + 0.02, LAYOUT.soda[1] + 0.12);
        group.scale.setScalar(1.15);
        this.stage.scene.add(group);
        this.cup = { group, fill: 0 };
        return 'sodaStart';
      }
      if (this.cup.fill < 1) return 'busy';
      const ok = this.serve({ kind: 'soda' });
      if (!ok) { bounce(this.cup.group); return 'wrong'; }
      const c = this.cup;
      this.cup = null;
      fly(c.group, c.group.position.clone().add(new THREE.Vector3(0, 0.3, -0.9)), 0.3, 0.3, () => this.stage.scene.remove(c.group));
      return 'served';
    }
    return 'nothing';
  }

  update(dt: number) {
    for (const gi of this.grill) {
      if (!gi) continue;
      gi.t += dt * this.cookSpeed;
      cookMain(gi.mesh, gi.t, COOK_AT, BURN_AT);
      // sizzle: roll a bit and puff smoke
      if (this.city.main !== 'crepe') gi.mesh.rotation.x = Math.sin(gi.t * 1.3) * 0.15;
      const burning = gi.t >= BURN_AT - 1.5;
      if (Math.random() < dt * (burning ? 9 : 3)) this.puff(gi.mesh.position, burning);
    }
    if (this.cup && this.cup.fill < 1) {
      this.cup.fill = Math.min(1, this.cup.fill + dt / SODA_TIME);
      const ud = this.cup.group.userData;
      ud.liquid.scale.y = Math.max(0.001, this.cup.fill);
      if (this.cup.fill >= 1) { ud.lid.visible = true; ud.straw.visible = true; bounce(this.cup.group); }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.userData.t += dt;
      const k = s.userData.t / s.userData.life;
      s.position.y += dt * 0.25;
      s.position.x += dt * 0.05;
      s.scale.setScalar(0.06 + k * 0.18);
      (s.material as THREE.SpriteMaterial).opacity = (1 - k) * s.userData.op;
      if (k >= 1) { this.stage.scene.remove(s); this.smoke.splice(i, 1); }
    }
    for (let i = bounces.length - 1; i >= 0; i--) {
      const b = bounces[i];
      b.t += dt;
      const k = Math.min(1, b.t / 0.25);
      const s = 1 + Math.sin(k * Math.PI) * 0.14;
      b.obj.scale.y = b.base * s;
      if (k >= 1) { b.obj.scale.y = b.base; bounces.splice(i, 1); }
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = 1 - (1 - k) * (1 - k);
      f.obj.position.lerpVectors(f.from, f.to, e);
      f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
      if (k >= 1) { flights.splice(i, 1); f.done?.(); }
    }
  }

  private puff(at: THREE.Vector3, dark: boolean) {
    if (this.smoke.length > 40) return;
    const m = new THREE.SpriteMaterial({ map: this.smokeTex, color: dark ? 0x333333 : 0xffffff, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.05, (Math.random() - 0.5) * 0.06));
    s.userData = { t: 0, life: 0.9 + Math.random() * 0.5, op: dark ? 0.7 : 0.45 };
    this.stage.scene.add(s);
    this.smoke.push(s);
  }

  /** Screen anchor (world position) of a station, for tutorial arrows */
  anchor(id: string): THREE.Vector3 {
    const xz = id === 'buns' ? LAYOUT.bunBox : id === 'sausages' ? LAYOUT.sausageBox : id === 'ketchup' ? LAYOUT.ketchup
      : id === 'mustard' ? LAYOUT.mustard : id === 'soda' ? LAYOUT.soda
      : id.startsWith('grill') ? LAYOUT.grillSlots[+id.slice(5)] : LAYOUT.plates[+id.slice(5)];
    return new THREE.Vector3(xz[0], COUNTER_Y + 0.25, xz[1]);
  }
}
