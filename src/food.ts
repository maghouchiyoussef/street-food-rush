import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BaseKind, MainKind } from './cities';

// Food meshes, built in code (chunky toy-like shapes), for every city.

const mat = (color: number, rough = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

/** The grilled item (sausage, meat strip, skewer, crêpe). Its color follows the cook time. */
export function mainItem(kind: MainKind, colors: [number, number, number]) {
  let geo: THREE.BufferGeometry;
  let extra: THREE.Object3D | null = null;
  let markY = 0.044;
  if (kind === 'sausage') {
    geo = new THREE.CapsuleGeometry(0.045, 0.24, 6, 12);
    geo.rotateZ(Math.PI / 2);
  } else if (kind === 'strip') {
    geo = new THREE.CapsuleGeometry(0.05, 0.2, 6, 12);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, 0.45, 1.35);
    markY = 0.024;
  } else if (kind === 'skewer') {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BoxGeometry(0.06, 0.055, 0.06, 2, 2, 2);
      // round the cubes a little
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < p.count; v++) {
        const vec = new THREE.Vector3().fromBufferAttribute(p, v);
        vec.lerp(vec.clone().normalize().multiplyScalar(0.036), 0.45);
        p.setXYZ(v, vec.x, vec.y, vec.z);
      }
      g.computeVertexNormals();
      g.rotateY(i * 0.4);
      g.translate(-0.1 + i * 0.066, 0, 0);
      parts.push(g);
    }
    geo = mergeGeometries(parts)!;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6), mat(0xd9b27a, 0.8));
    stick.rotation.z = Math.PI / 2;
    stick.position.x = 0.02;
    extra = stick;
    markY = 0.03;
  } else {
    geo = new THREE.CylinderGeometry(0.13, 0.13, 0.014, 28);
    markY = 0.008;
  }
  const m = new THREE.Mesh(geo, mat(colors[0], 0.4, { emissive: 0x000000 }));
  m.castShadow = true;
  if (extra) m.add(extra);
  // grill marks
  const markMat = mat(0x3a1a0e, 0.8);
  markMat.transparent = true; markMat.opacity = 0;
  for (const x of [-0.07, 0, 0.07]) {
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, kind === 'crepe' ? 0.16 : 0.06), markMat);
    mk.position.set(x, markY, 0);
    mk.rotation.y = 0.5;
    m.add(mk);
  }
  m.userData = { marks: markMat, raw: new THREE.Color(colors[0]), cooked: new THREE.Color(colors[1]), burnt: new THREE.Color(colors[2]), kind };
  return m;
}

/** Sets the item color for a cook time (seconds) */
export function cookMain(m: THREE.Mesh, t: number, cookAt: number, burnAt: number) {
  const material = m.material as THREE.MeshStandardMaterial;
  const { raw, cooked, burnt, marks } = m.userData as { raw: THREE.Color; cooked: THREE.Color; burnt: THREE.Color; marks: THREE.MeshStandardMaterial };
  const c = material.color;
  if (t < cookAt) c.copy(raw).lerp(cooked, t / cookAt);
  else if (t < burnAt) c.copy(cooked).lerp(burnt, Math.max(0, (t - cookAt - 2.2) / (burnAt - cookAt - 2.2)) * 0.55);
  else c.copy(burnt);
  marks.opacity = Math.min(1, t / cookAt);
  // glossy sparkle while perfectly cooked
  const perfect = t >= cookAt && t < cookAt + 2.2;
  material.emissive.setHex(perfect ? 0x3a1400 : 0x000000);
  material.roughness = perfect ? 0.25 : 0.45;
}

/** The base the food is served on (bun, tortilla, plate, pita, banana leaf). Returns [group, topY]. */
export function baseItem(kind: BaseKind): [THREE.Group, number] {
  const grp = new THREE.Group();
  if (kind === 'bun') {
    const bunMat = mat(0xe8a554, 0.7);
    for (const s of [-1, 1]) {
      const g = new THREE.CapsuleGeometry(0.05, 0.22, 6, 12);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 0.85, 1);
      const half = new THREE.Mesh(g, bunMat);
      half.position.set(0, 0.045, s * 0.05);
      half.castShadow = true;
      grp.add(half);
    }
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.06), mat(0xf7dfb0, 0.9));
    inner.position.y = 0.035;
    grp.add(inner);
    return [grp, 0.075];
  }
  if (kind === 'tortilla' || kind === 'pita') {
    const tortilla = kind === 'tortilla';
    const g = new THREE.CylinderGeometry(0.15, 0.15, tortilla ? 0.012 : 0.03, 28);
    // fold a little (U shape) so it looks like a taco / wrap
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) p.setY(v, p.getY(v) + (p.getZ(v) ** 2) * (tortilla ? 2.2 : 1.2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(tortilla ? 0xf0d27a : 0xe2b072, 0.85));
    m.position.y = 0.02;
    m.castShadow = true;
    grp.add(m);
    return [grp, 0.05];
  }
  if (kind === 'leaf') {
    const g = new THREE.CircleGeometry(0.17, 24);
    g.rotateX(-Math.PI / 2);
    g.scale(1.25, 1, 0.8);
    const m = new THREE.Mesh(g, mat(0x3a8a3a, 0.6, { side: THREE.DoubleSide }));
    m.position.y = 0.012;
    grp.add(m);
    return [grp, 0.04];
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.025, 32), mat(0xfafafa, 0.25));
  plate.position.y = 0.014;
  plate.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 32), mat(0x6a8ad0, 0.3));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.027;
  grp.add(plate, rim);
  return [grp, 0.045];
}

/** Sauce zig-zag line on top of the food */
export function sauceLine(color: number, phase = 0) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = -0.12 + (0.24 * i) / 24;
    pts.push(new THREE.Vector3(x, 0, Math.sin(i * 0.9 + phase) * 0.022));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.011, 6, false);
  return new THREE.Mesh(g, mat(color, 0.25));
}

/** Plate (paper tray) */
export function tray() {
  const shape = new THREE.Shape();
  const w = 0.2, h = 0.11, r = 0.04;
  shape.moveTo(-w + r, -h); shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h); shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r); shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat(0xffffff, 0.8));
  m.receiveShadow = true;
  return m;
}

/** Drink cup; returns the group (userData.liquid scale.y = fill 0..1) */
export function cup(liquidColor: number) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.18, 20, 1, true), mat(0xffffff, 0.6, { side: THREE.DoubleSide }));
  body.position.y = 0.09;
  body.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0655, 0.06, 0.05, 20, 1, true), mat(0x1e88e5, 0.5));
  stripe.position.y = 0.08;
  const liquidGeo = new THREE.CylinderGeometry(0.06, 0.047, 0.17, 20);
  liquidGeo.translate(0, 0.085, 0);
  const liquid = new THREE.Mesh(liquidGeo, mat(liquidColor, 0.2));
  liquid.position.y = 0.005;
  liquid.scale.y = 0.001;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.012, 20), mat(0xf0f0f0, 0.4));
  lid.position.y = 0.185;
  lid.visible = false;
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), mat(0xe53935, 0.4));
  straw.position.set(0.02, 0.24, 0);
  straw.rotation.z = -0.2;
  straw.visible = false;
  grp.add(body, stripe, liquid, lid, straw);
  grp.userData = { liquid, lid, straw };
  return grp;
}
