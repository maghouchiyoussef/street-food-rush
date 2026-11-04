import * as THREE from 'three';

// Food meshes, built in code (chunky toy-like shapes).

const mat = (color: number, rough = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

export const COLORS = {
  raw: new THREE.Color(0xe8909a),
  cooked: new THREE.Color(0xb5562a),
  perfect: new THREE.Color(0xa8491f),
  burnt: new THREE.Color(0x2a1a14),
};

/** Sausage lying along X. Its material color is driven by the cook level. */
export function sausage() {
  const g = new THREE.CapsuleGeometry(0.045, 0.24, 6, 12);
  g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(COLORS.raw.getHex(), 0.4, { emissive: 0x000000 }));
  m.castShadow = true;
  // grill marks
  const markMat = mat(0x3a1a0e, 0.8);
  markMat.transparent = true; markMat.opacity = 0;
  for (const x of [-0.07, 0, 0.07]) {
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.06), markMat);
    mk.position.set(x, 0.044, 0);
    mk.rotation.y = 0.5;
    m.add(mk);
  }
  m.userData.marks = markMat;
  return m;
}

/** Sets the sausage color for a cook time (seconds) */
export function cookSausage(m: THREE.Mesh, t: number, cookAt: number, burnAt: number) {
  const material = m.material as THREE.MeshStandardMaterial;
  const c = material.color;
  if (t < cookAt) c.copy(COLORS.raw).lerp(COLORS.cooked, t / cookAt);
  else if (t < burnAt) c.copy(COLORS.cooked).lerp(COLORS.burnt, Math.max(0, (t - cookAt - 2.2) / (burnAt - cookAt - 2.2)) * 0.55);
  else c.copy(COLORS.burnt);
  (m.userData.marks as THREE.MeshStandardMaterial).opacity = Math.min(1, t / cookAt);
  // glossy sparkle while perfectly cooked
  const perfect = t >= cookAt && t < cookAt + 2.2;
  material.emissive.setHex(perfect ? 0x3a1400 : 0x000000);
  material.roughness = perfect ? 0.25 : 0.45;
}

/** Hot dog bun (open, seen from above), length along X */
export function bun() {
  const grp = new THREE.Group();
  const bunMat = mat(0xe8a554, 0.7);
  const insideMat = mat(0xf7dfb0, 0.9);
  for (const s of [-1, 1]) {
    const g = new THREE.CapsuleGeometry(0.05, 0.22, 6, 12);
    g.rotateZ(Math.PI / 2);
    g.scale(1, 0.85, 1);
    const half = new THREE.Mesh(g, bunMat);
    half.position.set(0, 0.045, s * 0.05);
    half.castShadow = true;
    grp.add(half);
  }
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.06), insideMat);
  inner.position.y = 0.035;
  grp.add(inner);
  return grp;
}

/** Sauce zig-zag line on top of a sausage */
export function sauceLine(color: number, phase = 0) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = -0.12 + (0.24 * i) / 24;
    pts.push(new THREE.Vector3(x, 0, Math.sin(i * 0.9 + phase) * 0.022));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.011, 6, false);
  return new THREE.Mesh(g, mat(color, 0.25));
}

export const KETCHUP = 0xd8231b;
export const MUSTARD = 0xf2c418;

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

/** Soda cup; returns the group and the liquid mesh (scale.y = fill 0..1) */
export function cup() {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.18, 20, 1, true), mat(0xffffff, 0.6, { side: THREE.DoubleSide }));
  body.position.y = 0.09;
  body.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0655, 0.06, 0.05, 20, 1, true), mat(0x1e88e5, 0.5));
  stripe.position.y = 0.08;
  const liquidGeo = new THREE.CylinderGeometry(0.06, 0.047, 0.17, 20);
  liquidGeo.translate(0, 0.085, 0);
  const liquid = new THREE.Mesh(liquidGeo, mat(0x5a2a10, 0.2));
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
