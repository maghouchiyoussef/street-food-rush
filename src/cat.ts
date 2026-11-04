import * as THREE from 'three';
import type { Kitchen } from './kitchen';
import { COUNTER_Y, LAYOUT, type Stage } from './scene';

// The street cat: sometimes jumps on the counter and tries to steal food from the grill.
// Tap it to shoo it away (small bonus). Built in code.

const mat = (color: number, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });

function buildCat() {
  const g = new THREE.Group();
  const fur = mat(0xf0943a), light = mat(0xfff1dc), dark = mat(0x2a1a10, 0.4), pink = mat(0xf28c9a);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 6, 14), fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.11;
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 6, 12), light);
  belly.rotation.z = Math.PI / 2;
  belly.position.set(0, 0.085, 0.015);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), fur);
  head.position.set(0.16, 0.19, 0);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), light);
  muzzle.position.set(0.22, 0.17, 0);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), pink);
  nose.position.set(0.258, 0.185, 0);
  g.add(body, belly, head, muzzle, nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur);
    ear.position.set(0.15, 0.27, s * 0.045);
    ear.rotation.x = s * 0.25;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dark);
    eye.position.set(0.225, 0.215, s * 0.035);
    g.add(ear, eye);
  }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[0.09, 0.045], [0.09, -0.045], [-0.09, 0.045], [-0.09, -0.045]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.08, 8), fur);
    leg.position.set(x, 0.04, z);
    g.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.16, 4, 8), fur);
  tail.position.set(-0.17, 0.2, 0);
  tail.rotation.z = -0.6;
  g.add(tail);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  g.userData = { legs, tail };
  g.scale.setScalar(1.25);
  return g;
}

type State = 'away' | 'sneak' | 'grab' | 'flee';

export class Cat {
  obj = buildCat();
  hit: THREE.Mesh;
  private state: State = 'away';
  private timer = 0;
  private target = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 0;
  private dur = 1;
  private stolen: THREE.Object3D | null = null;
  enabled = false;
  onSteal: () => void = () => {};

  constructor(private stage: Stage, private kitchen: Kitchen) {
    this.obj.visible = false;
    stage.scene.add(this.obj);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.userData.hit = 'cat';
    this.obj.add(this.hit);
    this.hit.position.y = 0.15;
  }

  reset(enabled: boolean) {
    this.enabled = enabled;
    this.state = 'away';
    this.obj.visible = false;
    this.timer = 18 + Math.random() * 12;
    if (this.stolen) { this.stage.scene.remove(this.stolen); this.stolen = null; }
    const i = this.stage.hits.indexOf(this.hit);
    if (i >= 0) this.stage.hits.splice(i, 1);
  }

  private walk(to: THREE.Vector3, speed: number) {
    this.from.copy(this.obj.position);
    this.to.copy(to);
    this.t = 0;
    this.dur = Math.max(0.2, this.from.distanceTo(to) / speed);
    this.obj.rotation.y = Math.atan2(-(to.z - this.from.z), to.x - this.from.x);
  }

  /** Called when the player taps the cat. Returns true if it was shooed. */
  shoo(): boolean {
    if (this.state !== 'sneak' && this.state !== 'grab') return false;
    this.state = 'flee';
    const side = this.obj.position.x < 0 ? -1 : 1;
    this.walk(new THREE.Vector3(side * 2.2, COUNTER_Y, 0.6), 4.5);
    this.obj.position.y = COUNTER_Y + 0.15;
    return true;
  }

  update(dt: number) {
    if (!this.enabled) return;
    const ud = this.obj.userData as { legs: THREE.Mesh[]; tail: THREE.Mesh };
    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer > 0) return;
      // only come when there is something on the grill
      const slots = this.kitchen.grill.map((g, i) => (g ? i : -1)).filter(i => i >= 0);
      if (!slots.length) { this.timer = 3; return; }
      this.target = slots[Math.floor(Math.random() * slots.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      this.obj.position.set(side * 1.6, COUNTER_Y, 0.62);
      this.obj.visible = true;
      this.state = 'sneak';
      this.stage.hits.push(this.hit);
      const [x] = LAYOUT.grillSlots[this.target];
      this.walk(new THREE.Vector3(x + side * 0.05, COUNTER_Y, 0.66), 0.42);
    }
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    this.obj.position.lerpVectors(this.from, this.to, k);
    const moving = k < 1;
    ud.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(this.t * 16 + i * Math.PI) * 0.5 : 0; });
    ud.tail.rotation.x = Math.sin(this.t * 4) * 0.4;
    if (this.state === 'flee') this.obj.position.y = COUNTER_Y + Math.abs(Math.sin(k * Math.PI)) * 0.35;
    if (this.state === 'sneak' && !moving) {
      this.state = 'grab';
      this.timer = 1.4;           // last chance to shoo it
    } else if (this.state === 'grab') {
      this.obj.position.y = COUNTER_Y + Math.max(0, Math.sin(this.t * 10)) * 0.02;
      this.timer -= dt;
      if (this.timer <= 0) {
        const item = this.kitchen.grill[this.target];
        if (item) {
          this.kitchen.grill[this.target] = null;
          this.stage.scene.remove(item.mesh);
          this.stolen = item.mesh;
          this.obj.add(item.mesh);
          item.mesh.position.set(0.3, 0.17, 0);
          item.mesh.scale.setScalar(0.8);
          this.onSteal();
        }
        this.state = 'flee';
        const side = this.obj.position.x < 0 ? -1 : 1;
        this.walk(new THREE.Vector3(side * 2.2, COUNTER_Y, 0.62), 2.6);
      }
    } else if (this.state === 'flee' && !moving) {
      this.obj.visible = false;
      if (this.stolen) { this.obj.remove(this.stolen); this.stolen = null; }
      this.state = 'away';
      this.timer = 22 + Math.random() * 18;
      const i = this.stage.hits.indexOf(this.hit);
      if (i >= 0) this.stage.hits.splice(i, 1);
    }
  }
}
