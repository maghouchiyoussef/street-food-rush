import * as THREE from 'three';
import type { City } from './cities';
import { baseItem, mainItem } from './food';

// Renderer, camera, lights, the street background and the food cart counter.

export const COUNTER_Y = 1.0;
/** Layout of the stations on the counter (x, z) */
export const LAYOUT = {
  grillSlots: [[-0.36, 1.05], [0, 1.05], [0.36, 1.05]] as [number, number][],
  bunBox: [-0.46, 1.98] as [number, number],
  sausageBox: [0.46, 1.98] as [number, number],
  plates: [[-0.6, 0.26], [-0.1, 0.26]] as [number, number][],
  ketchup: [0.34, 0.22] as [number, number],
  mustard: [0.56, 0.22] as [number, number],
  soda: [0, 1.88] as [number, number],
  customers: [-0.72, 0, 0.72],
  customerZ: -0.48,
};

const mat = (color: number, rough = 0.6, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hits: THREE.Object3D[];      // tappable invisible boxes (userData.hit = id)
  ketchup: THREE.Group;
  mustard: THREE.Group;
  sodaMachine: THREE.Group;
  setCity(city: City): void;
  setBackground(tex: THREE.Texture): void;
  resize(): void;
}

function hitBox(id: string, w: number, h: number, d: number, x: number, y: number, z: number, hits: THREE.Object3D[], parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  m.userData.hit = id;
  parent.add(m);
  hits.push(m);
  return m;
}

function bottle(color: number, capColor: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 18), mat(color, 0.3));
  body.position.y = 0.1; body.castShadow = true;
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0.3));
  shoulder.position.y = 0.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 14), mat(capColor, 0.4));
  cap.position.y = 0.28;
  g.add(body, shoulder, cap);
  return g;
}

function crate(color: number) {
  const g = new THREE.Group();
  const wood = mat(color, 0.8);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.3), wood);
  base.position.y = 0.015;
  g.add(base);
  for (const [w, d, x, z] of [[0.36, 0.02, 0, 0.14], [0.36, 0.02, 0, -0.14], [0.02, 0.3, 0.17, 0], [0.02, 0.3, -0.17, 0]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), wood);
    side.position.set(x, 0.05, z);
    side.castShadow = true;
    g.add(side);
  }
  return g;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4a46a);
  scene.fog = new THREE.Fog(0xf4a46a, 9, 22);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
  const hits: THREE.Object3D[] = [];

  // Lights: warm sunset key light + soft sky fill
  scene.add(new THREE.HemisphereLight(0xffe2c4, 0x6a4a5a, 1.25));
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.4);
  sun.position.set(-3, 6, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 15 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);


  // Painted background (set later with setBackground)
  const bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.position.set(0, 1.7, -7);
  bg.visible = false;
  scene.add(bg);

  // ---------- The cart counter ----------
  const cart = new THREE.Group();
  scene.add(cart);
  const steel = mat(0xc8ccd2, 0.28, { metalness: 0.8 });
  const red = mat(0xd6342c, 0.45);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 3.7), mat(0xb4b8bf, 0.32, { metalness: 0.55 }));
  top.position.set(0, COUNTER_Y - 0.03, 1.72);
  top.receiveShadow = true;
  cart.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.4, COUNTER_Y - 0.06, 0.05), red);
  front.position.set(0, (COUNTER_Y - 0.06) / 2, -0.12);
  cart.add(front);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.05, 0.08), steel);
  trim.position.set(0, COUNTER_Y - 0.08, -0.13);
  cart.add(trim);

  // Grill
  const grill = new THREE.Group();
  grill.position.set(0, COUNTER_Y, 1.05);
  const grillBase = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.34), mat(0x2b2b30, 0.5, { metalness: 0.6 }));
  grillBase.position.y = 0.025;
  grillBase.receiveShadow = true;
  grill.add(grillBase);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.008, 0.3), mat(0x200000, 1, { emissive: 0xff4a10, emissiveIntensity: 0.35 }));
  glow.position.y = 0.05;
  grill.add(glow);
  const barMat = mat(0x18181b, 0.4, { metalness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.012, 0.012), barMat);
    bar.position.set(0, 0.058, -0.14 + i * 0.035);
    bar.receiveShadow = true;
    grill.add(bar);
  }
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.03, 0.38), steel);
  rim.position.y = 0.005;
  grill.add(rim);
  cart.add(grill);
  LAYOUT.grillSlots.forEach(([x, z], i) => hitBox(`grill${i}`, 0.34, 0.2, 0.36, x, COUNTER_Y + 0.08, z, hits, scene));

  // Bun crate
  const bunCrate = crate(0xb07a45);
  bunCrate.scale.setScalar(1.2);
  bunCrate.position.set(LAYOUT.bunBox[0], COUNTER_Y, LAYOUT.bunBox[1]);
  const crateFill = new THREE.Group();
  bunCrate.add(crateFill);
  cart.add(bunCrate);
  hitBox('buns', 0.44, 0.3, 0.4, LAYOUT.bunBox[0], COUNTER_Y + 0.1, LAYOUT.bunBox[1], hits, scene);

  // Sausage tray
  const sTray = new THREE.Group();
  sTray.position.set(LAYOUT.sausageBox[0], COUNTER_Y, LAYOUT.sausageBox[1]);
  sTray.scale.setScalar(1.2);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.28), mat(0x3d8bd9, 0.5));
  plate.position.y = 0.015;
  sTray.add(plate);
  const trayFill = new THREE.Group();
  sTray.add(trayFill);
  cart.add(sTray);
  hitBox('sausages', 0.44, 0.3, 0.38, LAYOUT.sausageBox[0], COUNTER_Y + 0.1, LAYOUT.sausageBox[1], hits, scene);

  // Plates slots (the trays themselves are created by the kitchen)
  LAYOUT.plates.forEach(([x, z], i) => hitBox(`plate${i}`, 0.46, 0.25, 0.3, x, COUNTER_Y + 0.08, z, hits, scene));

  // Sauce bottles
  const ketchup = bottle(0xd8231b, 0xffffff);
  ketchup.position.set(LAYOUT.ketchup[0], COUNTER_Y, LAYOUT.ketchup[1]);
  const mustard = bottle(0xf2c418, 0xd8231b);
  mustard.position.set(LAYOUT.mustard[0], COUNTER_Y, LAYOUT.mustard[1]);
  cart.add(ketchup, mustard);
  hitBox('ketchup', 0.2, 0.4, 0.26, LAYOUT.ketchup[0], COUNTER_Y + 0.15, LAYOUT.ketchup[1], hits, scene);
  hitBox('mustard', 0.2, 0.4, 0.26, LAYOUT.mustard[0], COUNTER_Y + 0.15, LAYOUT.mustard[1], hits, scene);

  // Soda machine
  const sodaMachine = new THREE.Group();
  sodaMachine.position.set(LAYOUT.soda[0], COUNTER_Y, LAYOUT.soda[1]);
  const machineMat = mat(0x1e63c9, 0.4);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.22), machineMat);
  box.position.set(0, 0.25 + 0.12, -0.06);
  box.castShadow = true;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.01), mat(0xffffff, 0.3, { emissive: 0x6fb7ff, emissiveIntensity: 0.6 }));
  panel.position.set(0, 0.5, 0.055);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.05, 10), steel);
  nozzle.position.set(0, 0.32, 0.06);
  const drip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.18), steel);
  drip.position.set(0, 0.01, 0.06);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), machineMat);
  legs.position.set(0, 0.06, -0.13);
  sodaMachine.add(box, panel, nozzle, drip, legs);
  cart.add(sodaMachine);
  hitBox('soda', 0.4, 0.65, 0.4, LAYOUT.soda[0], COUNTER_Y + 0.3, LAYOUT.soda[1] + 0.05, hits, scene);

  // Decor near the player: wooden board, tip jar, napkins, little menu sign
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 1.0), mat(0xb98a5a, 0.75));
  board.position.set(0, COUNTER_Y + 0.02, 2.8);
  board.receiveShadow = true;
  cart.add(board);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.24, 20, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  jar.position.set(0, COUNTER_Y + 0.16, 2.0);
  const coinsInJar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.07, 20), mat(0xf4c430, 0.3, { metalness: 0.8 }));
  coinsInJar.position.set(0, COUNTER_Y + 0.075, 2.0);

  // Striped awning edge at the top of the view (frames the screen)
  const awning = new THREE.Group();
  const stripeW = 0.25;
  const awningMats = [mat(0xd6342c, 0.7, { side: THREE.DoubleSide }), mat(0xffffff, 0.7, { side: THREE.DoubleSide })];
  for (let i = -8; i < 8; i++) {
    const g = new THREE.CylinderGeometry(stripeW / 2, stripeW / 2, 0.04, 16, 1, false, 0, Math.PI);
    const scallop = new THREE.Mesh(g, awningMats[Math.abs(i) % 2]);
    scallop.rotation.set(Math.PI / 2, 0, 0);
    scallop.position.set((i + 0.5) * stripeW, 0, 0);
    const panelS = new THREE.Mesh(new THREE.BoxGeometry(stripeW, 0.5, 0.03), scallop.material);
    panelS.position.set((i + 0.5) * stripeW, 0.25, 0);
    awning.add(scallop, panelS);
  }
  awning.position.set(0, 3.0, -0.6);
  scene.add(awning);

  const stage: Stage = {
    renderer, scene, camera, hits, ketchup, mustard, sodaMachine,
    setCity(city) {
      red.color.setHex(city.cart.body);
      steel.color.setHex(city.cart.trim);
      awningMats[0].color.setHex(city.cart.awning[0]);
      awningMats[1].color.setHex(city.cart.awning[1]);
      machineMat.color.setHex(city.cart.machine);
      (scene.background as THREE.Color).setHex(city.sky);
      scene.fog!.color.setHex(city.sky);
      [ketchup, mustard].forEach((b, i) => {
        ((b.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(city.sauces[i]);
        ((b.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(city.sauces[i]);
      });
      crateFill.clear();
      for (let i = 0; i < 3; i++) {
        const [b] = baseItem(city.base);
        if (city.base === 'bun') b.position.set(0, 0.03 + (i === 2 ? 0.07 : 0), -0.07 + (i % 2) * 0.13 + (i === 2 ? 0.065 : 0));
        else b.position.set(0, 0.02 + i * 0.035, 0);
        b.scale.setScalar(city.base === 'bun' ? 1.15 : 0.95);
        crateFill.add(b);
      }
      trayFill.clear();
      const n = city.main === 'crepe' ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const m = mainItem(city.main, city.mainColors);
        if (city.main === 'crepe') m.position.set(0, 0.04 + i * 0.016, 0);
        else m.position.set(0, city.main === 'strip' ? 0.05 : 0.075, -0.09 + i * 0.06);
        m.scale.setScalar(city.main === 'crepe' ? 0.95 : 1.05);
        trayFill.add(m);
      }
    },
    setBackground(tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      bgMat.map = tex; bgMat.needsUpdate = true;
      const a = (tex.image as HTMLImageElement).width / (tex.image as HTMLImageElement).height;
      bg.scale.set(11 * a, 11, 1);
      bg.visible = true;
    },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      // Keep the whole counter (±1.3 m) visible on narrow phones
      const dist = 2.9;
      const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(1.12 / (dist * aspect)));
      camera.fov = THREE.MathUtils.clamp(vfov, 45, 76);
      // on less tall phones (16:9) look a bit higher so the order bubbles stay below the top bar
      const k = THREE.MathUtils.clamp((aspect - 0.46) / 0.1, 0, 1);
      camera.position.set(0, 3.2, 2.95);
      camera.lookAt(0, 0.95 + 0.3 * k, 0.82 - 0.25 * k);
      camera.updateProjectionMatrix();
    },
  };
  stage.resize();
  return stage;
}
