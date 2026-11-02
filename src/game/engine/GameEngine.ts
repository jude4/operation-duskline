import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld, RAPIER } from '../physics/PhysicsWorld';
import { buildEnvironment } from '../environment/Environment';
import { InteractionSystem } from '../environment/InteractionSystem';
import { MissionManager } from '../missions/MissionManager';
import { Weapon } from '../weapons/Weapon';
import { EnemySystem } from '../enemies/EnemySystem';
import { AudioManager } from '../audio/AudioManager';
import { ParticleManager } from '../effects/ParticleManager';
import { initialState, type GameState, type GameActions, type Settings } from '../../types';

type Environment = Awaited<ReturnType<typeof buildEnvironment>>;
type Door = { pivot: THREE.Group; leaf: THREE.Mesh; body: RAPIER.RigidBody; open: boolean; angle: number; z: number; kind: string };
type Dynamic = { mesh: THREE.Object3D; body: RAPIER.RigidBody; start: THREE.Vector3 };
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const GLASS_CENTER: [number, number, number] = [8.5, 1.9, -67.2];
const GLASS_SIZE: [number, number, number] = [0.08, 3.6, 3.3];

export class GameEngine implements GameActions {
  state: GameState = { ...initialState };
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(78, 1, 0.035, 190);
  readonly physics = new PhysicsWorld();
  private renderer!: THREE.WebGLRenderer;
  private controls!: PointerLockControls;
  private environment?: Environment;
  private weapon!: Weapon;
  private enemies!: EnemySystem;
  private interactions!: InteractionSystem;
  private mission = new MissionManager(text => this.notify(text));
  private audio = new AudioManager();
  private effects!: ParticleManager;
  private keys = new Set<string>();
  private doors: Door[] = [];
  private dynamic: Dynamic[] = [];
  private surfaces: THREE.Object3D[] = [];
  private interactableMeshes: THREE.Object3D[] = [];
  private card!: THREE.Group;
  private ammoPickup!: THREE.Group;
  private healthPickup!: THREE.Group;
  private dataModule!: THREE.Group;
  private extraction!: THREE.Group;
  private objectiveMarkers: THREE.Object3D[] = [];
  private glass!: THREE.Mesh;
  private glassCollider?: RAPIER.Collider;
  private storageLid!: THREE.Group;
  private storageOpen = false;
  private storageUsed = false;
  private auxiliaryPower = true;
  private auxiliaryLights: THREE.PointLight[] = [];
  private weaponType: 'rifle' | 'sidearm' = 'rifle';
  private magazines = { rifle: { ammo: 30, reserve: 150 }, sidearm: { ammo: 12, reserve: 60 } };
  private reloading = 0;
  private cooldown = 0;
  private firing = false;
  private ads = false;
  private recoil = 0;
  private time = 0;
  private elapsed = 0;
  private stepAccumulator = 0;
  private lastFrame = 0;
  private lastEmit = 0;
  private notificationTime = 0;
  private frame = 0;
  private disposed = false;
  private initialized = false;
  private headHeight = 1.65;
  private stick = new THREE.Vector2();
  private touchCrouch = false;
  private touch = matchMedia('(pointer: coarse)').matches;
  private ray = new THREE.Raycaster();
  private envTarget?: THREE.WebGLRenderTarget;
  private cleanup: (() => void)[] = [];
  private flashlight!: THREE.SpotLight;
  private lightTarget = new THREE.Object3D();
  private frozenTime = 0;
  private priorGrounded = false;
  private inputGamepadAim = false;
  private gamepadConnected = false;

  constructor(private container: HTMLElement, private onState: (s: GameState) => void, private settings: Settings) {}

  async init() {
    try {
      this.emit();
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setClearColor(0x4a6268);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.info.autoReset = false;
      this.renderer.domElement.setAttribute('aria-label', 'Blacksite 07 real-time 3D environment');
      this.container.appendChild(this.renderer.domElement);
      this.scene.background = new THREE.Color(0x536a70);
      this.scene.fog = new THREE.FogExp2(0x53636a, 0.018);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envTarget = pmrem.fromScene(room, 0.04);
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = 0.38;
      room.dispose(); pmrem.dispose();
      this.scene.add(this.camera);
      this.camera.position.set(12, 6.5, 14);
      this.camera.lookAt(-1, 2, -16);
      this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
      this.controls.minPolarAngle = 0.13;
      this.controls.maxPolarAngle = Math.PI - 0.13;
      this.controls.enabled = false;
      this.controls.addEventListener('unlock', this.onUnlock);
      this.progress(12, 'Initialising collision systems');
      await this.physics.init();
      if (this.disposed) return;
      this.progress(25, 'Loading Blacksite 07');
      this.environment = await buildEnvironment(this.scene, this.physics.addBox, p => this.progress(25 + p * 0.38, 'Loading environment geometry'));
      if (this.disposed) { this.environment.dispose(); return; }
      this.surfaces = [...this.environment.surfaces];
      this.progress(68, 'Preparing field equipment');
      this.weapon = new Weapon(this.camera);
      await this.weapon.load();
      this.weaponVisible(false);
      this.effects = new ParticleManager(this.scene);
      this.interactions = new InteractionSystem(this.camera, this.surfaces);
      this.createInteractables();
      this.enemies = new EnemySystem(this.scene, this.surfaces, (damage, pos) => this.hurt(damage, pos), () => { this.state.kills++; this.notify('SECURITY UNIT DISABLED'); });
      this.createFlashlight();
      this.bindEvents();
      this.setSettings(this.settings);
      this.progress(100, 'All systems operational');
      this.initialized = true;
      this.state.phase = 'menu';
      this.emit();
      this.frame = requestAnimationFrame(this.tick);
      this.installDiagnostics();
    } catch (e) {
      if (this.disposed) return;
      console.error('Duskline initialization failed:', e);
      this.state.phase = 'error';
      this.state.error = e instanceof Error ? e.message : String(e);
      this.emit();
    }
  }

  private progress(progress: number, label: string) { this.state.progress = Math.round(progress); this.state.loadingLabel = label; this.emit(); }
  private emit() {
    if (this.disposed) return;
    this.state.objective = this.mission.stage;
    this.state.objectiveText = this.mission.text;
    this.state.hasKey = this.mission.hasKey;
    this.state.hasData = this.mission.hasData;
    this.onState({ ...this.state });
  }
  private notify(text: string) { this.state.notification = text; this.notificationTime = 4.5; }
  private weaponVisible(visible: boolean) { if (this.weapon) this.weapon.root.visible = visible; }

  start = () => { if (!this.initialized || this.state.phase === 'playing') return; if (['menu', 'dead', 'complete'].includes(this.state.phase)) this.resetMission(); this.activate(); };
  resume = () => { if (this.state.phase === 'paused') this.activate(); };
  private activate() {
    void this.audio.init();
    this.audio.setVolumes(this.settings.volume, this.settings.effectsVolume);
    this.audio.setPaused(false);
    this.state.phase = 'playing';
    this.controls.enabled = true;
    this.weaponVisible(true);
    this.flashlight.visible = true;
    this.keys.clear(); this.firing = false; this.ads = false;
    this.emit();
    if (!this.touch) {
      try { this.controls.lock(); } catch { this.pause(); this.notify('Mouse capture unavailable. Click Resume to try again.'); this.emit(); }
    }
  }
  pause = () => {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'paused'; this.controls.enabled = false;
    this.firing = false; this.ads = false; this.keys.clear(); this.stick.set(0, 0);
    this.audio.setPaused(true); this.controls.unlock(); this.emit();
  };
  restart = () => { if (!this.initialized) return; this.resetMission(); this.activate(); };
  exit = () => {
    this.state.phase = 'menu'; this.controls.enabled = false; this.controls.unlock();
    this.audio.setPaused(true); this.firing = false; this.ads = false; this.keys.clear();
    this.weaponVisible(false); this.flashlight.visible = false; this.emit();
  };
  setSettings = (settings: Settings) => {
    this.settings = { ...settings };
    this.audio.setVolumes(settings.volume, settings.effectsVolume);
    if (!this.renderer) return;
    this.controls.pointerSpeed = settings.sensitivity;
    this.renderer.shadowMap.enabled = settings.quality !== 'low';
    this.scene.traverse(o => { if (o instanceof THREE.Light && o.shadow) o.shadow.autoUpdate = settings.quality !== 'low'; });
    this.resize();
  };
  interact = () => { if (this.state.phase === 'playing') { this.scene.updateMatrixWorld(true); this.interactions.interact(); this.emit(); } };
  reload = () => {
    if (this.state.phase !== 'playing' || this.reloading > 0) return;
    const m = this.magazines[this.weaponType];
    if (m.ammo >= this.capacity || m.reserve <= 0) return;
    this.reloading = 1.9; this.state.reloading = true; this.audio.play('reload'); this.ads = false; this.emit();
  };
  mobileMove = (x: number, y: number) => { this.stick.set(x, y).clampLength(0, 1); };
  mobileLook = (x: number, y: number) => {
    if (this.state.phase !== 'playing') return;
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    e.y -= x * 0.004 * this.settings.sensitivity; e.x = THREE.MathUtils.clamp(e.x - y * 0.004 * this.settings.sensitivity, -1.4, 1.4);
    this.camera.quaternion.setFromEuler(e);
  };
  fire = (pressed: boolean) => { this.firing = this.state.phase === 'playing' && pressed; };
  aim = (pressed: boolean) => { this.ads = this.state.phase === 'playing' && pressed; };
  jump = () => { if (this.state.phase === 'playing') { if (this.physics.grounded && !this.physics.crouched) this.audio.play('jump'); this.physics.jump(); } };
  crouch = () => { this.touchCrouch = !this.touchCrouch; };

  private get capacity() { return this.weaponType === 'rifle' ? 30 : 12; }
  private changeWeapon(type: 'rifle' | 'sidearm') {
    if (this.weaponType === type || this.reloading > 0) return;
    this.weaponType = type;
    this.weapon.setType(type); this.cooldown = 0.35; this.audio.play('switch');
    this.state.weapon = type === 'rifle' ? 'VXR–7' : 'K9 / SIDEARM';
    this.syncAmmo(); this.emit();
  }
  private syncAmmo() { const m = this.magazines[this.weaponType]; this.state.ammo = m.ammo; this.state.reserve = m.reserve; }
  private resetMission() {
    this.mission.reset();
    this.state = { ...initialState, phase: 'playing', progress: 100, loadingLabel: 'All systems operational' };
    this.elapsed = 0; this.time = 0; this.stepAccumulator = 0; this.reloading = 0; this.cooldown = 0;
    this.magazines = { rifle: { ammo: 30, reserve: 150 }, sidearm: { ammo: 12, reserve: 60 } };
    this.weaponType = 'rifle'; this.weapon.setType('rifle');
    this.physics.setCrouch(false); this.physics.teleport(0, 0.05, 11);
    this.camera.position.set(0, 1.7, 11); this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.headHeight = 1.65; this.recoil = 0; this.touchCrouch = false;
    this.card.visible = true; this.dataModule.visible = true; this.ammoPickup.visible = true; this.healthPickup.visible = true;
    this.objectiveMarkers.forEach(m => m.visible = true);
    for (const d of this.doors) { d.open = false; d.angle = 0; d.pivot.rotation.y = 0; this.syncDoor(d, true); }
    this.dynamic.forEach(d => { d.body.setTranslation(d.start, true); d.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); d.body.setLinvel({ x: 0, y: 0, z: 0 }, true); d.body.setAngvel({ x: 0, y: 0, z: 0 }, true); });
    this.glass.visible = true;
    if (!this.glassCollider) this.glassCollider = this.physics.addBox(GLASS_CENTER, GLASS_SIZE);
    this.storageOpen = false; this.storageUsed = false; this.storageLid.rotation.x = 0; this.auxiliaryPower = true;
    this.dataModule.getObjectByName('classified-module')!.visible = true;
    this.auxiliaryLights.forEach(l => l.intensity = 8);
    this.enemies.reset(); this.effects.reset(); this.frozenTime = 0;
    this.notify('DUSKLINE ACTUAL · Find the access card at the west loading station');
  }

  private createFlashlight() {
    this.flashlight = new THREE.SpotLight(0xdceaff, 9, 28, 0.48, 0.7, 1.5);
    this.flashlight.position.set(0.2, -0.1, -0.1);
    this.lightTarget.position.set(0, 0, -10); this.camera.add(this.lightTarget);
    this.flashlight.target = this.lightTarget; this.camera.add(this.flashlight); this.flashlight.visible = false;
  }
  private createInteractables() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x263a3f, roughness: 0.48, metalness: 0.7 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xed9c4f, emissive: 0x6f330b, emissiveIntensity: 0.4, roughness: 0.4 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x76c6c1, emissive: 0x4cacaa, emissiveIntensity: 1.2, roughness: 0.3 });
    const box = (size: [number, number, number], mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D = this.scene) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const pickup = (type: string, pos: [number, number, number], color: THREE.Material) => {
      const g = new THREE.Group(); g.position.set(...pos); this.scene.add(g);
      box(type === 'card' ? [0.36, 0.48, 0.045] : [0.5, 0.28, 0.34], color, [0, 0, 0], g);
      if (type === 'card') { box([0.25, 0.06, 0.01], metal, [0, 0.1, 0.03], g); box([0.08, 0.11, 0.01], cyan, [-0.06, -0.06, 0.03], g); }
      else if (type === 'health') { box([0.2, 0.035, 0.015], cyan, [0, 0, 0.18], g); box([0.035, 0.16, 0.015], cyan, [0, 0, 0.18], g); }
      this.marker(type === 'card' ? 'ACCESS CREDENTIALS' : type === 'health' ? 'MEDICAL' : 'RESUPPLY', new THREE.Vector3(0, 0.7, 0), g);
      this.interactableMeshes.push(g); return g;
    };
    this.card = pickup('card', [-11, 1.25, -4], orange);
    this.interactions.add({ id: 'card', root: this.card, label: () => 'COLLECT ACCESS CARD', action: () => { if (this.mission.acquireKey()) { this.card.visible = false; this.audio.play('pickup'); } } });
    this.ammoPickup = pickup('ammo', [-5, 0.9, -20], metal);
    this.interactions.add({ id: 'ammo', root: this.ammoPickup, label: () => 'COLLECT AMMUNITION', action: () => { this.magazines.rifle.reserve += 60; this.magazines.sidearm.reserve += 24; this.ammoPickup.visible = false; this.audio.play('pickup'); this.syncAmmo(); this.notify('AMMUNITION REPLENISHED · +60 / +24'); } });
    this.healthPickup = pickup('health', [-2.5, 0.9, -53], orange);
    this.interactions.add({ id: 'health', root: this.healthPickup, label: () => this.state.health < 100 ? 'USE MEDICAL SUPPLIES' : 'MEDICAL SUPPLIES · HEALTH FULL', action: () => { if (this.state.health < 100) { this.state.health = Math.min(100, this.state.health + 55); this.healthPickup.visible = false; this.audio.play('pickup'); this.notify('MEDICAL SUPPLIES · +55 HEALTH'); } } });

    for (const [z, kind] of [[-10, 'facility'], [-59, 'research'], [-78, 'exit']] as const) {
      const pivot = new THREE.Group(); pivot.position.set(-3, 0, z); this.scene.add(pivot);
      const leaf = box([6, 4.4, 0.23], metal, [3, 2.2, 0], pivot);
      for (let i = 0; i < 7; i++) box([5.65, 0.045, 0.04], orange, [3, 0.4 + i * 0.58, 0.14], pivot);
      box([0.15, 0.65, 0.2], orange, [5.5, 1.7, 0.2], pivot);
      box([0.75, 0.32, 0.05], cyan, [4.8, 2.5, 0.15], pivot);
      this.marker(kind === 'exit' ? 'SERVICE EXIT' : kind === 'research' ? 'RESEARCH / 07' : '07 / ACCESS CONTROL', new THREE.Vector3(3, 3.6, 0.16), pivot);
      const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2.2, z));
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(3, 2.2, 0.115), body);
      const door = { pivot, leaf, body, open: false, angle: 0, z, kind }; this.doors.push(door);
      this.surfaces.push(leaf); this.interactableMeshes.push(pivot);
      this.interactions.add({ id: `door-${kind}`, root: pivot, range: 3.8,
        label: () => (kind === 'facility' && !this.mission.hasKey) ? 'LOCKED · ACCESS CARD REQUIRED' : (kind === 'exit' && !this.mission.hasData) ? 'LOCKED · RECOVER DATA MODULE' : `${door.open ? 'CLOSE' : 'OPEN'} ${kind.toUpperCase()} DOOR`,
        action: () => {
          if (kind === 'facility' && !this.mission.hasKey) { this.notify('ACCESS DENIED · Find the card at the west loading station'); this.audio.play('empty'); return; }
          if (kind === 'exit' && !this.mission.hasData) { this.notify('EXTRACTION SEALED · Recover the classified data module'); this.audio.play('empty'); return; }
          if (door.open && Math.abs(this.physics.position.z - z) < 1.5 && Math.abs(this.physics.position.x) < 3.5) { this.notify('DOORWAY OBSTRUCTED · Stand clear'); return; }
          door.open = !door.open; this.audio.play('door', pivot.position);
        }
      });
    }

    this.dataModule = new THREE.Group(); this.dataModule.position.set(5, 1.25, -70); this.scene.add(this.dataModule);
    box([1.5, 0.12, 0.85], metal, [0, 0, 0], this.dataModule);
    const display = box([1.05, 0.72, 0.08], metal, [0, 0.52, -0.27], this.dataModule); display.rotation.x = -0.12;
    box([0.9, 0.58, 0.02], new THREE.MeshStandardMaterial({ map: this.screenTexture(), emissiveMap: this.screenTexture(), emissive: 0x79c8bd, emissiveIntensity: 0.9, roughness: 0.35 }), [0, 0.52, -0.21], this.dataModule);
    const module = box([0.25, 0.12, 0.38], orange, [0.48, 0.18, 0.03], this.dataModule); module.name = 'classified-module';
    this.marker('CLASSIFIED DATA / RECOVER', new THREE.Vector3(0, 1.25, 0), this.dataModule);
    this.interactableMeshes.push(this.dataModule);
    this.interactions.add({ id: 'terminal', root: this.dataModule, label: () => this.mission.hasData ? 'DATA RECOVERED · PROCEED TO EXTRACTION' : 'ACCESS TERMINAL · RECOVER DATA MODULE', action: () => {
      if (this.mission.acquireData()) { module.visible = false; this.audio.play('terminal'); } else if (!this.mission.hasData) this.notify('RESEARCH ACCESS REQUIRED · Enter the control room first');
    } });

    const power = new THREE.Group(); power.position.set(-3.5, 1.5, -47); this.scene.add(power);
    box([0.28, 0.65, 0.45], metal, [0, 0, 0], power); const lever = box([0.12, 0.3, 0.12], orange, [0.2, 0, 0], power);
    this.marker('AUXILIARY POWER', new THREE.Vector3(0.3, 0.6, 0), power);
    this.interactions.add({ id: 'switch', root: power, label: () => `SWITCH AUXILIARY LIGHTS ${this.auxiliaryPower ? 'OFF' : 'ON'}`, action: () => { this.auxiliaryPower = !this.auxiliaryPower; this.auxiliaryLights.forEach(l => l.intensity = this.auxiliaryPower ? 8 : 0); lever.rotation.z = this.auxiliaryPower ? 0 : 0.7; this.audio.play('switch'); this.notify(`AUXILIARY LIGHTING ${this.auxiliaryPower ? 'ONLINE' : 'OFFLINE'}`); } });
    for (const z of [-47, -55]) { const light = new THREE.PointLight(0xffa655, 8, 9, 2); light.position.set(-2.8, 2.8, z); this.scene.add(light); this.auxiliaryLights.push(light); }

    const storage = new THREE.Group(); storage.position.set(8, 0.55, -31); this.scene.add(storage);
    box([1.8, 1, 1.2], metal, [0, 0, 0], storage);
    this.storageLid = new THREE.Group(); this.storageLid.position.set(0, 0.55, -0.6); storage.add(this.storageLid);
    box([1.86, 0.15, 1.26], orange, [0, 0, 0.6], this.storageLid);
    this.marker('FIELD STORAGE', new THREE.Vector3(0, 1, 0), storage);
    this.physics.addBox([8, 0.55, -31], [1.8, 1, 1.2]);
    this.interactions.add({ id: 'storage', root: storage, label: () => this.storageOpen ? 'CLOSE FIELD STORAGE' : 'OPEN FIELD STORAGE · RESUPPLY', action: () => { this.storageOpen = !this.storageOpen; if (this.storageOpen && !this.storageUsed) { this.magazines.rifle.reserve += 30; this.storageUsed = true; this.syncAmmo(); this.notify('FIELD STORAGE · +30 ROUNDS'); } this.audio.play('door', storage.position); } });

    this.glass = box(GLASS_SIZE, new THREE.MeshPhysicalMaterial({ color: 0xa1c7c9, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.23, side: THREE.DoubleSide }), GLASS_CENTER);
    this.glass.userData.breakable = true; this.surfaces.push(this.glass);
    this.glassCollider = this.physics.addBox(GLASS_CENTER, GLASS_SIZE);
    for (const x of [-8.5, 8.5]) for (const z of [-72.5, -69, -65.5]) this.physics.addBox([x, 2, z], [0.12, 4, 0.12]);
    for (const [x, z] of [[-2.7, -26], [3.2, -66], [8, -88]]) {
      const mesh = box([0.8, 0.8, 0.8], metal, [x, 1.2, z]);
      for (const y of [-0.3, 0.3]) box([0.85, 0.05, 0.85], orange, [0, y, 0], mesh);
      const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.2, z).setLinearDamping(0.7).setAngularDamping(0.7));
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 0.4, 0.4).setDensity(4).setFriction(0.6), body);
      mesh.userData.body = body; this.dynamic.push({ mesh, body, start: new THREE.Vector3(x, 1.2, z) }); this.surfaces.push(mesh);
      this.interactions.add({ id: `crate-${z}`, root: mesh, label: () => 'PUSH EQUIPMENT CRATE', action: () => { const dir = this.camera.getWorldDirection(new THREE.Vector3()); body.applyImpulse({ x: dir.x * 7, y: 1, z: dir.z * 7 }, true); this.audio.play('impact', mesh.position); } });
    }

    this.extraction = new THREE.Group(); this.extraction.position.set(0, 0.04, -94); this.scene.add(this.extraction);
    const circle = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.3, 64), new THREE.MeshBasicMaterial({ color: 0xb7cf87, transparent: true, opacity: 0.65, side: THREE.DoubleSide, toneMapped: false })); circle.rotation.x = -Math.PI / 2; this.extraction.add(circle);
    const beacon = new THREE.PointLight(0x9aca8e, 12, 8); beacon.position.y = 1; this.extraction.add(beacon);
    this.marker('EXTRACTION / 07', new THREE.Vector3(0, 2.5, 0), this.extraction);
  }

  private marker(text: string, pos: THREE.Vector3, parent: THREE.Object3D) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#122024cc'; c.fillRect(1, 1, 510, 94); c.strokeStyle = '#b7c88699'; c.strokeRect(1, 1, 510, 94);
    c.fillStyle = '#d9e0bc'; c.font = '600 21px monospace'; c.textAlign = 'center'; c.fillText(text, 256, 57);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, sizeAttenuation: true }));
    sprite.scale.set(2.8, 0.525, 1); sprite.position.copy(pos); parent.add(sprite); this.objectiveMarkers.push(sprite);
    return sprite;
  }
  private screenTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d')!;
    x.fillStyle = '#102e32'; x.fillRect(0, 0, 512, 320); x.fillStyle = '#a3d8c7'; x.font = 'bold 24px monospace'; x.fillText('DUSKLINE // RESEARCH', 24, 42);
    x.font = '16px monospace'; ['SECURE ARCHIVE / BLACKSITE 07', 'CLASSIFIED MODULE: ONLINE', 'PROTOCOL .... 82.04.07', '■ ENCRYPTED UPLINK ACTIVE', '', '> RECOVER DATA MODULE [E]'].forEach((s, i) => x.fillText(s, 24, 92 + i * 32));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  private syncDoor(d: Door, immediate = false) {
    d.pivot.updateMatrixWorld(true);
    const pos = d.leaf.getWorldPosition(new THREE.Vector3()); const q = d.leaf.getWorldQuaternion(new THREE.Quaternion());
    if (immediate) { d.body.setTranslation(pos, true); d.body.setRotation(q, true); }
    d.body.setNextKinematicTranslation(pos); d.body.setNextKinematicRotation(q);
  }

  private shoot() {
    if (this.cooldown > 0 || this.reloading > 0) return;
    const m = this.magazines[this.weaponType];
    this.cooldown = this.weaponType === 'rifle' ? 0.135 : 0.26;
    if (m.ammo <= 0) { this.audio.play('empty'); this.notify('MAGAZINE EMPTY · PRESS R TO RELOAD'); return; }
    m.ammo--; this.syncAmmo(); this.weapon.shoot(); this.audio.play('shot');
    this.recoil = Math.min(this.recoil + 0.012, 0.035);
    this.camera.rotation.x = Math.min(1.4, this.camera.rotation.x + (this.ads ? 0.005 : 0.009));
    this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(new THREE.Vector2(), this.camera); this.ray.far = 100;
    const hit = this.ray.intersectObjects([...this.enemies.targets, ...this.surfaces, ...this.interactableMeshes], true).find(h => {
      let o: THREE.Object3D | null = h.object;
      while (o) { if (!o.visible) return false; o = o.parent; }
      return !(h.object instanceof THREE.Sprite);
    });
    if (hit) {
      const normal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3(0, 1, 0);
      const isEnemy = this.enemies.hit(hit.object, this.weaponType === 'rifle' ? 28 : 24);
      if (isEnemy) this.state.hit = 0.16;
      else if (hit.object.userData.breakable) {
        hit.object.visible = false;
        if (this.glassCollider) { this.physics.world.removeCollider(this.glassCollider, true); this.glassCollider = undefined; }
        this.audio.play('glass', hit.point);
      }
      const body = hit.object.userData.body as RAPIER.RigidBody | undefined;
      if (body) { const f = this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5); body.applyImpulseAtPoint(f, hit.point, true); }
      this.effects.impact(hit.point, normal, !isEnemy && !body && !hit.object.userData.breakable);
      this.audio.play('impact', hit.point);
    }
    this.enemies.alert(this.physics.position);
  }
  private hurt(damage: number, pos: THREE.Vector3) {
    if (this.state.phase !== 'playing') return;
    this.state.health = Math.max(0, this.state.health - damage); this.state.damage = 0.65;
    this.audio.play('enemy', pos); this.audio.play('hurt');
    if (this.state.health <= 0) {
      this.state.phase = 'dead'; this.controls.enabled = false; this.controls.unlock(); this.audio.setPaused(true); this.emit();
    }
  }

  private tick = (stamp: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const rawDt = (stamp - (this.lastFrame || stamp)) / 1000;
    const dt = Math.min(rawDt, 0.08); this.lastFrame = stamp;
    if (dt <= 0) return;
    if (this.state.phase === 'playing') this.updateGame(dt);
    else if (this.state.phase === 'menu') {
      this.frozenTime += dt;
      this.camera.position.set(12 + Math.sin(this.frozenTime * 0.055) * 2, 6.5, 14 + Math.sin(this.frozenTime * 0.08));
      this.camera.lookAt(-1, 2, -16);
      this.environment?.update(dt, this.frozenTime);
    }
    this.state.fps += (1 / rawDt - this.state.fps) * 0.04;
    if (stamp - this.lastEmit > 100) { this.emit(); this.lastEmit = stamp; }
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    this.weapon?.renderOverlay(this.renderer, this.scene);
  };
  private updateGame(dt: number) {
    this.time += dt; this.elapsed += dt; this.state.elapsed = this.elapsed;
    this.pollGamepad(dt);
    const forward = this.camera.getWorldDirection(_forward); forward.y = 0; forward.normalize();
    const right = _right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    const mx = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.stick.x;
    const mz = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) + this.stick.y;
    _move.copy(forward).multiplyScalar(mz).addScaledVector(right, mx); if (_move.length() > 1) _move.normalize();
    this.physics.setCrouch(this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC') || this.touchCrouch);
    const aiming = (this.ads || this.inputGamepadAim) && this.reloading <= 0;
    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !aiming && !this.physics.crouched && mz > 0;
    this.state.sprinting = sprinting && _move.lengthSq() > 0.1; this.state.crouching = this.physics.crouched; this.state.aiming = aiming;
    this.doors.forEach(d => { d.angle = THREE.MathUtils.damp(d.angle, d.open ? -Math.PI * 0.53 : 0, 4, dt); d.pivot.rotation.y = d.angle; this.syncDoor(d); });
    this.storageLid.rotation.x = THREE.MathUtils.damp(this.storageLid.rotation.x, this.storageOpen ? -1.4 : 0, 5, dt);
    this.stepAccumulator = Math.min(this.stepAccumulator + dt, 0.12);
    while (this.stepAccumulator >= 1 / 60) { this.physics.step(1 / 60, _move, sprinting, aiming); this.stepAccumulator -= 1 / 60; }
    const p = this.physics.position;
    const speed = Math.hypot(this.physics.velocity.x, this.physics.velocity.z);
    const moving = this.physics.grounded ? Math.min(1, speed / 4.2) : 0;
    this.headHeight = THREE.MathUtils.damp(this.headHeight, this.physics.crouched ? 1.03 : 1.65, 12, dt);
    const bob = this.settings.motion ? Math.sin(this.time * (sprinting ? 15 : 10)) * moving * (sprinting ? 0.035 : 0.018) : 0;
    this.camera.position.set(p.x, p.y + this.headHeight + bob, p.z);
    if (!this.priorGrounded && this.physics.grounded && this.elapsed > 0.4) this.audio.play('land');
    this.priorGrounded = this.physics.grounded;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, aiming ? this.settings.fov * 0.76 : this.settings.fov + (sprinting ? 5 : 0), 10, dt); this.camera.updateProjectionMatrix();
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 12, dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading = Math.max(0, this.reloading - dt);
      if (this.reloading === 0) { const m = this.magazines[this.weaponType]; const amount = Math.min(this.capacity - m.ammo, m.reserve); m.ammo += amount; m.reserve -= amount; this.state.reloading = false; this.syncAmmo(); }
    }
    if (this.firing && !sprinting) this.shoot();
    this.weapon.update(dt, { time: this.time, moving, sprinting: this.state.sprinting, crouching: this.physics.crouched, aiming, reloading: this.reloading > 0, reloadProgress: this.reloading > 0 ? 1 - this.reloading / 1.9 : 0, motion: this.settings.motion });
    this.dynamic.forEach(d => { const p = d.body.translation(); const q = d.body.rotation(); d.mesh.position.set(p.x, p.y, p.z); d.mesh.quaternion.set(q.x, q.y, q.z, q.w); });
    this.state.area = p.z > -10 ? 'LOADING YARD' : p.z > -42 ? 'MAIN WAREHOUSE' : p.z > -60 ? 'SERVICE CORRIDOR' : p.z > -78 ? 'RESEARCH CONTROL' : 'EXTRACTION ZONE';
    this.state.heading = ((THREE.MathUtils.radToDeg(Math.atan2(-forward.x, -forward.z)) % 360) + 360) % 360;
    this.mission.enterArea(p.z);
    this.enemies.update(dt, this.time, this.camera.position);
    this.scene.updateMatrixWorld(true);
    this.state.prompt = this.interactions.update();
    this.environment?.update(dt, this.time); this.effects.update(dt);
    this.audio.update(dt, { area: this.state.area, moving, sprinting, position: this.camera.position, forward: this.camera.getWorldDirection(new THREE.Vector3()) });
    this.state.hit = Math.max(0, this.state.hit - dt); this.state.damage = Math.max(0, this.state.damage - dt);
    if (this.notificationTime > 0) { this.notificationTime -= dt; if (this.notificationTime <= 0) this.state.notification = ''; }
    if (this.state.phase === 'playing' && this.mission.hasData && Math.hypot(p.x, p.z + 94) < 2.3 && this.mission.extract()) {
      this.state.phase = 'complete'; this.firing = false; this.controls.enabled = false; this.controls.unlock(); this.audio.play('complete'); this.emit();
    }
    this.extraction.children.forEach(o => { if (o instanceof THREE.PointLight) o.intensity = this.mission.hasData ? 12 + Math.sin(this.time * 3) * 3 : 2; });
  }

  private pollGamepad(dt: number) {
    const g = navigator.getGamepads?.()[0]; if (!g) { this.inputGamepadAim = false; if (this.gamepadConnected) { this.stick.set(0, 0); this.firing = false; this.gamepadConnected = false; } return; }
    this.gamepadConnected = true;
    const dead = (v: number) => Math.abs(v) < 0.16 ? 0 : v;
    this.stick.set(dead(g.axes[0] || 0), -dead(g.axes[1] || 0));
    this.mobileLook(dead(g.axes[2] || 0) * dt * 430, dead(g.axes[3] || 0) * dt * 430);
    this.inputGamepadAim = (g.buttons[6]?.value ?? 0) > 0.3;
    if ((g.buttons[7]?.value ?? 0) > 0.3) this.fire(true); else if (!this.keys.has('Mouse0')) this.fire(false);
    if (g.buttons[0]?.pressed) this.jump(); if (g.buttons[2]?.pressed) this.reload(); if (g.buttons[3]?.pressed && !this.keys.has('PadE')) { this.interact(); this.keys.add('PadE'); } else if (!g.buttons[3]?.pressed) this.keys.delete('PadE');
  }
  private onUnlock = () => { if (this.state.phase === 'playing') this.pause(); };
  private resize = () => {
    if (!this.renderer) return;
    const w = this.container.clientWidth || innerWidth, h = this.container.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.quality === 'high' ? 1.65 : this.settings.quality === 'medium' ? 1.25 : 1));
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  private bindEvents() {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => { window.addEventListener(type, fn); this.cleanup.push(() => window.removeEventListener(type, fn)); };
    on('resize', this.resize);
    on('keydown', e => {
      if (this.state.phase !== 'playing') return;
      if (['Space', 'ControlLeft', 'ControlRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pause();
      if (e.code === 'KeyE') this.interact(); if (e.code === 'KeyR') this.reload(); if (e.code === 'Space') this.jump();
      if (e.code === 'KeyF') this.weapon.inspect(); if (e.code === 'Digit1') this.changeWeapon('rifle'); if (e.code === 'Digit2') this.changeWeapon('sidearm');
      if (e.code === 'KeyL') this.flashlight.visible = !this.flashlight.visible;
    });
    on('keyup', e => this.keys.delete(e.code));
    on('mousedown', e => { if (this.state.phase !== 'playing' || (!this.controls.isLocked && !this.touch)) return; if (e.button === 0) { this.keys.add('Mouse0'); this.fire(true); } if (e.button === 2) this.aim(true); });
    on('mouseup', e => { if (e.button === 0) { this.keys.delete('Mouse0'); this.fire(false); } if (e.button === 2) this.aim(false); });
    on('contextmenu', e => { if (this.state.phase === 'playing') e.preventDefault(); });
    on('blur', () => this.pause());
    const hidden = () => { if (document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', hidden); this.cleanup.push(() => document.removeEventListener('visibilitychange', hidden));
    const lockError = () => { if (this.state.phase === 'playing') { this.pause(); this.notify('MOUSE CAPTURE BLOCKED · Click Resume to try again'); this.emit(); } };
    document.addEventListener('pointerlockerror', lockError); this.cleanup.push(() => document.removeEventListener('pointerlockerror', lockError));
  }

  /** Diagnostics are available only on the development server with ?test=1, never in production. */
  private installDiagnostics() {
    if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('test')) return;
    (window as unknown as Record<string, unknown>).__DUSKLINE__ = {
      snapshot: () => ({ ...this.state, position: this.physics.position.toArray(), grounded: this.physics.grounded, doors: this.doors.map(d => ({ kind: d.kind, open: d.open, angle: d.angle })), living: this.enemies.living, render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures } }),
      teleport: (x: number, y: number, z: number) => { this.physics.teleport(x, y, z); this.camera.position.set(x, y + this.headHeight, z); },
      lookAt: (x: number, y: number, z: number) => { this.camera.lookAt(x, y, z); this.scene.updateMatrixWorld(true); },
      input: (code: string, down: boolean) => { if (down) this.keys.add(code); else this.keys.delete(code); },
      interact: this.interact, fire: this.fire, reload: this.reload, aim: this.aim, jump: this.jump,
      enemyPositions: () => this.enemies.targets.map(t => t.getWorldPosition(new THREE.Vector3()).toArray()),
      hurt: (amount: number) => this.hurt(amount, this.camera.position),
      audio: () => this.audio.diagnostics(),
      props: () => ({ auxiliaryPower: this.auxiliaryPower, lightIntensities: this.auxiliaryLights.map(l => l.intensity), storageOpen: this.storageOpen, storageUsed: this.storageUsed, glassIntact: this.glass.visible, dynamicPositions: this.dynamic.map(d => ({ position: d.mesh.position.toArray(), rotation: d.mesh.quaternion.toArray() })) }),
    };
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.cleanup.forEach(fn => fn());
    this.controls?.removeEventListener('unlock', this.onUnlock); if (this.controls?.isLocked) this.controls.unlock(); this.controls?.dispose();
    this.audio.dispose(); this.weapon?.dispose(); this.enemies?.dispose(); this.effects?.dispose(); this.environment?.dispose();
    if (this.physics.world) this.physics.dispose();
    const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) { if ('geometry' in o) geos.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { mats.add(m); Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); }); } });
    textures.forEach(t => t.dispose()); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    this.envTarget?.dispose(); this.renderer?.dispose(); this.renderer?.domElement.remove();
    if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__DUSKLINE__;
  }
}
