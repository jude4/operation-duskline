import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface WeaponInput {
  time: number;
  moving: number;
  sprinting: boolean;
  crouching: boolean;
  aiming: boolean;
  reloading: boolean;
  motion: boolean;
  reloadProgress: number;
}

type WeaponType = 'rifle' | 'sidearm';
interface Casing { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }

/** Camera-space, original Blender-authored rifle, sidearm and operator arms.
 * Physics and ammunition belong to the engine; this class owns presentation only.
 */
export class Weapon {
  readonly root = new THREE.Group();
  private rifle?: THREE.Object3D;
  private sidearm?: THREE.Object3D;
  private magazine?: THREE.Object3D;
  private magazineHome = new THREE.Vector3();
  private rifleMuzzle?: THREE.Object3D;
  private sidearmMuzzle?: THREE.Object3D;
  private flash = new THREE.Group();
  private flashLight = new THREE.PointLight(0xffc578, 0, 3, 2);
  private smoke: THREE.Mesh;
  private flashTime = 0;
  private recoil = 0;
  private inspection = 0;
  private switchTime = 0;
  private type: WeaponType = 'rifle';
  private mixer?: THREE.AnimationMixer;
  private bolt?: THREE.AnimationAction;
  private casingPool: Casing[] = [];
  private elapsed = 0;
  private temp = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private targetRotation = new THREE.Euler();
  private disposed = false;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.root.name = 'First-person viewmodel';
    this.root.position.set(.25, -.29, -.50);
    this.root.scale.setScalar(.9);
    camera.add(this.root);
    this.flash.name = 'Pooled muzzle flash';
    const star = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? .017 : .085 * (i % 4 ? .7 : 1);
      if (!i) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffd9a1, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false });
    const starMesh = new THREE.Mesh(new THREE.ShapeGeometry(star), flashMaterial);
    starMesh.renderOrder = 1002;
    this.flash.add(starMesh);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.032, .16, 6), flashMaterial.clone());
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -.06;
    flame.renderOrder = 1002;
    this.flash.add(flame, this.flashLight);
    this.root.add(this.flash);
    this.flash.visible = false;
    this.smoke = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 5), new THREE.MeshBasicMaterial({ color: 0xa7bac0, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }));
    this.smoke.renderOrder = 1001;
    this.root.add(this.smoke);
    const casingGeo = new THREE.CylinderGeometry(.004, .004, .018, 6);
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0xb79a54, metalness: .72, roughness: .37, depthTest: false });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(casingGeo, casingMaterial);
      mesh.visible = false; mesh.renderOrder = 1001;
      mesh.layers.set(31);
      camera.add(mesh);
      this.casingPool.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    // A restrained local fill keeps the viewmodel readable under overhead lamps.
    const fill = new THREE.PointLight(0xe0d9c8, .60, 2.4, 1);
    fill.position.set(-.15, .2, -.25);
    this.root.add(fill);
    const ambient = new THREE.HemisphereLight(0xa8c6ce, 0x344037, 1.45);
    this.root.add(ambient);
    this.root.traverse(object => object.layers.set(31));
  }

  async load(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/vxr7.glb`);
    if (this.disposed) return;
    this.root.add(gltf.scene);
    this.rifle = gltf.scene.getObjectByName('VXR7_Assembly');
    this.sidearm = gltf.scene.getObjectByName('Kestrel_Assembly');
    this.magazine = gltf.scene.getObjectByName('Magazine');
    if (this.magazine) this.magazineHome.copy(this.magazine.position);
    this.rifleMuzzle = gltf.scene.getObjectByName('Muzzle');
    this.sidearmMuzzle = gltf.scene.getObjectByName('Kestrel_Muzzle');
    gltf.scene.traverse(object => {
      object.frustumCulled = false;
      object.layers.set(31);
      if (object instanceof THREE.Mesh) {
        // Internal depth is essential: far-side glove geometry must remain occluded.
        // A separate overlay pass prevents intersection with nearby world geometry.
        object.renderOrder = 1000;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.depthTest = true;
          material.fog = false;
          if (material instanceof THREE.MeshStandardMaterial) {
            material.envMapIntensity = .9;
            const name = material.name.toLowerCase();
            if (name.includes('woven olive glove')) { material.color.setRGB(.08, .102, .064); material.metalness = 0; material.roughness = .98; }
            else if (name.includes('reinforced leather')) { material.color.setRGB(.025, .033, .022); material.metalness = 0; material.roughness = .91; }
            else if (name.includes('field jacket')) { material.color.setRGB(.035, .057, .052); material.roughness = .96; }
            else if (name.includes('cuff webbing')) { material.color.setRGB(.063, .08, .055); material.roughness = 1; }
            else if (name.includes('graphite steel')) { material.color.setRGB(.055, .068, .066); material.roughness = .58; material.metalness = .68; }
            else if (name.includes('machined edges')) { material.color.setRGB(.12, .145, .14); material.roughness = .57; }
            else if (name.includes('olive ceramic')) { material.color.setRGB(.10, .125, .078); material.roughness = .71; }
          }
        }
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    if (gltf.animations.length) {
      this.bolt = this.mixer.clipAction(gltf.animations[0]);
      this.bolt.setLoop(THREE.LoopOnce, 1);
      this.bolt.clampWhenFinished = true;
    }
    this.setType(this.type);
  }

  setType(type: WeaponType): void {
    if (this.type !== type) this.switchTime = .48;
    this.type = type;
    if (this.rifle) this.rifle.visible = type === 'rifle';
    if (this.sidearm) this.sidearm.visible = type === 'sidearm';
  }

  switchWeapon(): void { this.setType(this.type === 'rifle' ? 'sidearm' : 'rifle'); }
  inspect(): void { this.inspection = 2.2; }

  getMuzzlePosition(): THREE.Vector3 {
    this.root.updateWorldMatrix(true, true);
    const muzzle = this.type === 'rifle' ? this.rifleMuzzle : this.sidearmMuzzle;
    return muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : this.root.localToWorld(new THREE.Vector3(0, .037, -.812));
  }

  shoot(): void {
    this.flashTime = .07;
    this.recoil = Math.min(this.recoil + .036, .078);
    this.bolt?.reset().setEffectiveTimeScale(3.5).play();
    this.camera.updateWorldMatrix(true, true);
    const slot = this.casingPool.find(casing => casing.life <= 0) || this.casingPool[0];
    slot.mesh.position.set(this.root.position.x + .07, this.root.position.y + .06, this.root.position.z - .05);
    slot.mesh.visible = true;
    slot.velocity.set(.6 + Math.random() * .5, .4 + Math.random() * .35, .2 + Math.random() * .2);
    slot.life = .8;
  }

  update(dt: number, input: WeaponInput): void {
    this.elapsed += dt;
    this.mixer?.update(dt);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 17, dt);
    this.inspection = Math.max(0, this.inspection - dt);
    this.switchTime = Math.max(0, this.switchTime - dt);
    const aim = input.aiming && !input.reloading && !input.sprinting;
    const move = Math.min(Math.abs(input.moving), 1);
    const motion = input.motion ? 1 : 0;
    const walkFrequency = input.sprinting ? 13 : 8.7;
    const bob = Math.sin(input.time * walkFrequency);
    const bob2 = Math.cos(input.time * walkFrequency * .5);
    const reload = input.reloading ? Math.sin(Math.PI * Math.min(1, Math.max(0, input.reloadProgress))) : 0;
    const inspect = this.inspection > 0 ? Math.sin((1 - this.inspection / 2.2) * Math.PI) : 0;
    const change = this.switchTime > 0 ? Math.sin(this.switchTime / .48 * Math.PI) : 0;
    const sidearm = this.type === 'sidearm';
    this.targetPosition.set(aim ? 0 : (sidearm ? .19 : .25), aim ? (sidearm ? -.135 : -.1962) : -.29, aim ? -.36 : -.50);
    this.targetPosition.y += motion * (bob * move * (aim ? .0015 : .009) + Math.sin(input.time * 1.5) * .0018);
    this.targetPosition.x += bob2 * .007 * move * motion * (aim ? .15 : 1);
    this.targetPosition.y -= reload * .13 + change * .3;
    this.targetPosition.x += reload * .035 + inspect * -.10;
    this.targetPosition.z += this.recoil + reload * .07;
    this.targetRotation.set(-this.recoil * 1.8 - reload * .45 + inspect * .08, (input.sprinting ? -.25 : 0) + inspect * .6, (input.sprinting ? -.22 : 0) - reload * .48 + inspect * -.48);
    this.targetPosition.y -= input.sprinting ? .055 : 0;
    this.targetRotation.z += bob * move * .008 * motion;
    const smooth = 1 - Math.exp(-dt * 14);
    this.root.position.lerp(this.targetPosition, smooth);
    this.root.rotation.x = THREE.MathUtils.lerp(this.root.rotation.x, this.targetRotation.x, smooth);
    this.root.rotation.y = THREE.MathUtils.lerp(this.root.rotation.y, this.targetRotation.y, smooth);
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, this.targetRotation.z, smooth);
    if (this.magazine) {
      this.magazine.position.copy(this.magazineHome);
      if (input.reloading) {
        const p = input.reloadProgress;
        this.magazine.position.y -= Math.sin(Math.min(1, p * 1.7) * Math.PI) * .19;
        this.magazine.rotation.x = -Math.sin(p * Math.PI) * .18;
      } else this.magazine.rotation.x = 0;
    }
    const marker = sidearm ? this.sidearmMuzzle : this.rifleMuzzle;
    this.root.updateWorldMatrix(true, true);
    if (marker) {
      marker.getWorldPosition(this.temp);
      this.root.worldToLocal(this.temp);
      this.flash.position.copy(this.temp);
    }
    this.flash.visible = this.flashTime > 0;
    this.flash.rotation.z = this.elapsed * 52;
    this.flash.scale.setScalar(.7 + this.flashTime * 7);
    this.flashLight.intensity = this.flashTime > 0 ? 5 : 0;
    const smokeLife = this.flashTime > 0 ? 1 : THREE.MathUtils.damp((this.smoke.material as THREE.MeshBasicMaterial).opacity, 0, 6, dt);
    if (this.flashTime > 0) { this.smoke.position.copy(this.flash.position); this.smoke.scale.setScalar(1); }
    else { this.smoke.position.y += dt * .055; this.smoke.position.z -= dt * .035; this.smoke.scale.addScalar(dt * 1.8); }
    (this.smoke.material as THREE.MeshBasicMaterial).opacity = Math.min(.18, smokeLife);
    for (const casing of this.casingPool) {
      if (casing.life <= 0) continue;
      casing.life -= dt;
      casing.velocity.y -= dt * 2.2;
      casing.mesh.position.addScaledVector(casing.velocity, dt);
      casing.mesh.rotation.x += dt * 11;
      casing.mesh.rotation.z += dt * 7;
      casing.mesh.visible = casing.life > 0;
    }
  }

  /** Draw after the world. Layers preserve correct self-occlusion while keeping
   * the held weapon clear of walls; world transparency and shadows stay intact.
   */
  renderOverlay(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    if (!this.root.visible || this.disposed) return;
    const mask = this.camera.layers.mask;
    const background = scene.background;
    const autoClear = renderer.autoClear;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    scene.background = null;
    this.camera.layers.set(31);
    renderer.clearDepth();
    renderer.render(scene, this.camera);
    this.camera.layers.mask = mask;
    scene.background = background;
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const disposeObject = (object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    };
    this.root.traverse(disposeObject);
    for (const casing of this.casingPool) { disposeObject(casing.mesh); casing.mesh.removeFromParent(); }
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.flashLight.dispose();
  }
}
