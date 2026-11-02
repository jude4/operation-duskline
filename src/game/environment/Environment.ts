import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type Vec = [number, number, number];
export interface EnvironmentHandle {
  surfaces: THREE.Object3D[];
  update(dt: number, time: number): void;
  dispose(): void;
}

/** An original Blender-authored modular Blacksite, with lightweight runtime weather. */
export async function buildEnvironment(
  scene: THREE.Scene,
  addBox: (center: Vec, size: Vec) => void,
  onProgress?: (p: number) => void,
): Promise<EnvironmentHandle> {
  const root = new THREE.Group();
  root.name = 'BLACKSITE 07';
  scene.add(root);
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/environment.glb`, event => {
    if (event.total) onProgress?.(event.loaded / event.total);
  });
  root.add(gltf.scene);
  const textures: THREE.Texture[] = [];
  const grain = (base: string, contrast: number, wet = false) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 18000; i++) {
      const v = rand() > .5 ? 255 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},${rand() * contrast})`;
      ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 3, 1 + rand() * 3);
    }
    if (wet) for (let i = 0; i < 12; i++) {
      ctx.fillStyle = 'rgba(13,24,26,.25)'; ctx.beginPath(); ctx.ellipse(rand() * 256, rand() * 256, 10 + rand() * 30, 5 + rand() * 10, rand() * 3, 0, Math.PI * 2); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace; texture.repeat.set(7, 7); texture.anisotropy = 4;
    textures.push(texture); return texture;
  };
  // A tiny original sky/industrial reflection cube gives wet metal real PBR response.
  const reflectionFaces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, face === 2 ? '#b3c9cc' : '#718e98');
    gradient.addColorStop(.48, '#45626a'); gradient.addColorStop(1, '#15292f');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    if (face !== 2 && face !== 3) { ctx.fillStyle = '#b99c69'; ctx.fillRect(9, 31, 11, 3); ctx.fillRect(43, 29, 7, 3); }
    return canvas;
  });
  const reflection = new THREE.CubeTexture(reflectionFaces); reflection.colorSpace = THREE.SRGBColorSpace;
  reflection.needsUpdate = true; textures.push(reflection); scene.environment = reflection; scene.environmentIntensity = .8;
  const concrete = grain('#a4adaa', .23), asphalt = grain('#738184', .2, true), metal = grain('#bac3b7', .13);
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true; object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.name === 'concrete') { material.map = concrete; material.roughness = .85; }
      if (material.name === 'asphalt') { material.map = asphalt; material.roughness = .36; }
      if (material.name.startsWith('paint')) { material.map = metal; material.roughness = .55; }
      material.needsUpdate = true;
    }
  });
  const surfaces: THREE.Object3D[] = [gltf.scene];
  // Rapier uses deliberately simple collision hulls around detailed display geometry.
  addBox([0, -.3, -43], [80, .6, 150]);
  for (const x of [-18, 18]) addBox([x, 1.7, 3], [.4, 3.4, 30]);
  addBox([0, 2, 17], [36, 4, .4]);
  for (const x of [-16, 16]) addBox([x, 1.5, -10], [4, 3, .3]);
  for (const x of [-14, 14]) addBox([x, 4, -26], [.45, 8, 32]);
  for (const z of [-10, -42]) {
    for (const x of [-8.5, 8.5]) addBox([x, 4, z], [11, 8, .5]);
    addBox([0, 6.6, z], [6.2, 2.8, .5]);
  }
  addBox([0, 8.1, -26], [29, .25, 33]);
  for (const x of [-4, 4]) addBox([x, 2.2, -51], [.35, 4.4, 18]);
  addBox([0, 4.45, -51], [8.4, .2, 18]);
  for (const x of [-12, 12]) addBox([x, 2.6, -69], [.4, 5.2, 18]);
  for (const z of [-60, -78]) {
    for (const x of [-7.5, 7.5]) addBox([x, 2.6, z], [9, 5.2, .4]);
    addBox([0, 4.25, z], [6, 1.9, .4]);
  }
  addBox([0, 5.3, -69], [24, .2, 18]);
  for (const x of [-15, 15]) addBox([x, 1.5, -92], [.3, 3, 28]);
  addBox([0, 1.5, -106], [30, 3, .3]);
  for (const x of [-13.5, 13.5]) addBox([x, 1.5, -78], [3, 3, .3]);
  for (const [center, size] of [
    [[-11, 1.65, 1], [5.4, 3.3, 9]], [[11, 1.65, 0], [5.4, 3.3, 10]], [[-11, 1.65, -7.5], [5.4, 3.3, 5]],
    [[-5, .58, 6], [4.2, 1.16, .95]], [[6, .58, 4], [4.2, 1.16, .95]], [[10, 1, 9], [2.5, 2, 5.8]],
    [[-6.7, 1.2, -5], [2.8, 2.4, 1.4]], [[-5.7, 1.25, -22], [2.8, 2.5, 1.4]], [[5, .625, -36], [1.25, 1.25, 1.25]],
    [[5, 1.5, -18.5], [1.9, 3, 4.8]], [[-6, .7, -99], [1.4, 1.4, 1.4]], [[6, .7, -84], [1.4, 1.4, 1.4]],
  ] as [Vec, Vec][]) addBox(center, size);
  for (const x of [-10.5, 10.5]) for (const z of [-18, -26, -34]) addBox([x, 2.4, z], [2.8, 4.8, 4.8]);
  for (const x of [-10.9, 10.9]) for (const z of [-64, -67, -70, -73, -76]) addBox([x, 1.2, z], [1.35, 2.4, 1.7]);
  for (const x of [-7, 7]) for (const z of [-64, -74]) addBox([x, .55, z], [3, 1.1, 1.1]);
  for (const x of [-10, 10]) addBox([x, 1.3, -88], [3.3, 2.6, 5]);

  // The filmic split between amber lamps and a cool, readable dusk sky.
  scene.background = new THREE.Color('#182e36');
  scene.fog = new THREE.FogExp2('#203a40', .017);
  const hemi = new THREE.HemisphereLight('#c0dfe0', '#25313b', 2.3); root.add(hemi);
  const moon = new THREE.DirectionalLight('#c9e6e4', 2.5);
  moon.position.set(-12, 26, 16); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -35; moon.shadow.camera.right = 35;
  moon.shadow.camera.top = 35; moon.shadow.camera.bottom = -35; moon.shadow.camera.far = 100;
  moon.shadow.normalBias = .06; moon.shadow.bias = -.0002; root.add(moon);
  const point = (p: Vec, color: string, intensity: number, range: number) => {
    const light = new THREE.PointLight(color, intensity, range, 2); light.position.set(...p); root.add(light); return light;
  };
  point([-13, 6, 3], '#ffb45c', 180, 23); point([13, 6, 2], '#ffb45c', 180, 23);
  point([0, 5, -8], '#ffd294', 120, 22);
  point([-7, 6.2, -20], '#ffc781', 140, 20); point([7, 6.2, -34], '#ffd197', 150, 22);
  const flicker = point([0, 3.9, -50], '#addde6', 55, 14);
  point([0, 4.8, -68], '#a7dee3', 145, 23);
  const warning = point([2.5, 2.7, -58], '#ef4726', 15, 8);
  point([-12, 5, -91], '#ffc676', 100, 22); point([12, 5, -99], '#9cd4db', 130, 22);

  const label = (text: string, p: Vec, w: number, h: number, color = '#c1c6b7', background = '#1c2b2e', size = 90) => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = color; ctx.font = `bold ${size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 129, 970);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: .65, metalness: .1, emissive: '#6b7066', emissiveMap: tex, emissiveIntensity: .12 }));
    mesh.position.set(...p); root.add(mesh); return mesh;
  };
  label('B L A C K S I T E   0 7', [0, 6.85, -9.35], 13, 2.15, '#cdd4c7', '#233438', 92);
  label('RESEARCH  /  LOGISTICS', [0, 5.45, -9.35], 7, .65, '#9caeaa', '#172a2f', 65);
  label('RESTRICTED AREA', [8.4, 2.7, -9.71], 3.1, .9, '#161f21', '#c5914b', 100);
  label('07', [-8.5, 2.7, -9.71], 4, 2.2, '#a9bbb6', '#293c3d', 175);
  label('CAUTION   /   AUTHORIZED PERSONNEL ONLY', [0, 4.48, -9.60], 5.6, .42, '#182124', '#bd8b45', 55);
  label('02  /  STORAGE', [0, 5.5, -41.68], 5, 1, '#b7c9c4', '#172b2e', 80);
  label('RESEARCH CONTROL', [0, 3.7, -59.77], 5.3, .6, '#c6d8cf', '#1f3337', 76);
  label('EXTRACTION  →', [0, 3.65, -77.77], 4.8, .6, '#c4d7c4', '#253b36', 82);
  label('DUSKLINE  //  INDUSTRIAL SYSTEMS', [-11, 2.1, 5.54], 4.4, .75, '#b9cbc7', '#1e3337', 65);

  // Ground stencils and wet highlights are real geometry, not a backdrop.
  const lineMaterial = new THREE.MeshStandardMaterial({ color: '#bfa469', roughness: .7, transparent: true, opacity: .5, polygonOffset: true, polygonOffsetFactor: -1 });
  const plane = (x: number, z: number, w: number, h: number, mat: THREE.Material, y = .012) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  for (const x of [-3.3, 3.3]) { plane(x, -25, .09, 30, lineMaterial); plane(x, 3, .1, 20, lineMaterial); }
  for (let z = 13; z > -8; z -= 3.5) plane(0, z, .10, 1.3, lineMaterial);
  for (let z = -13; z > -40; z -= 5) {
    const arrow = new THREE.Shape(); arrow.moveTo(-.25, .5); arrow.lineTo(0, -.5); arrow.lineTo(.25, .5); arrow.lineTo(0, .28); arrow.closePath();
    const mark = new THREE.Mesh(new THREE.ShapeGeometry(arrow), lineMaterial); mark.rotation.x = -Math.PI / 2; mark.position.set(0, .014, z); root.add(mark);
  }
  const puddleMat = new THREE.MeshPhysicalMaterial({ color: '#314d53', metalness: .82, roughness: .12, transparent: true, opacity: .45, depthWrite: false, clearcoat: 1 });
  for (const [x, z, sx, sz] of [[-4, 10, 3.3, 1.4], [4, -4, 3, 1.5], [-15, 5, 2.5, 4], [5, 8, 1.8, 3], [0, -84, 4, 2], [5, -98, 3, 2]]) {
    const circle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), puddleMat); circle.rotation.x = -Math.PI / 2; circle.scale.set(sx, sz, 1); circle.position.set(x, .022, z); root.add(circle);
  }
  // Roof ventilation fans have clean pivots and run only with game time.
  const fans: THREE.Group[] = [];
  for (const z of [-18, -33]) {
    const fan = new THREE.Group(); fan.position.set(0, 7.15, z); root.add(fan); fans.push(fan);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .18, 12), new THREE.MeshStandardMaterial({ color: '#45575a', metalness: .7, roughness: .5 })); fan.add(hub);
    for (let i = 0; i < 4; i++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(1.25, .035, .19), hub.material); blade.position.set(Math.cos(i * Math.PI / 2) * .65, 0, Math.sin(i * Math.PI / 2) * .65); blade.rotation.y = -i * Math.PI / 2; fan.add(blade); }
  }
  // A compact rain system outside the roofed interiors.
  const rainCount = 850, rainPositions = new Float32Array(rainCount * 6);
  let rainSeed = 17;
  const rand = () => { rainSeed = (rainSeed * 16807) % 2147483647; return rainSeed / 2147483647; };
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - .5) * 38, z = i < 650 ? rand() * 26 - 9 : rand() * 28 - 105, y = rand() * 15;
    rainPositions.set([x, y, z, x + .055, y - .55, z + .035], i * 6);
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#b6d6de', transparent: true, opacity: .24, depthWrite: false })); rain.frustumCulled = false; root.add(rain);
  const dustPosition = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) dustPosition.set([(rand() - .5) * 22, rand() * 6 + .5, -12 - rand() * 28], i * 3);
  const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPosition, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#b7c8bc', size: .045, transparent: true, opacity: .4, depthWrite: false })); root.add(dust);
  onProgress?.(1);
  return {
    surfaces,
    update(dt, time) {
      for (const fan of fans) fan.rotation.y += dt * 1.8;
      warning.intensity = 10 + Math.max(0, Math.sin(time * 3)) * 10;
      flicker.intensity = Math.sin(time * 3.7) > .985 ? 13 : 55;
      dust.position.x = Math.sin(time * .2) * .3;
      for (let i = 0; i < rainCount; i++) {
        const offset = i * 6; rainPositions[offset + 1] -= dt * 11; rainPositions[offset + 4] -= dt * 11;
        if (rainPositions[offset + 1] < 0) { rainPositions[offset + 1] = 15; rainPositions[offset + 4] = 14.45; }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      scene.remove(root);
      if (scene.environment === reflection) scene.environment = null;
      moon.shadow.map?.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) { geometries.add(object.geometry); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat); } });
      for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
