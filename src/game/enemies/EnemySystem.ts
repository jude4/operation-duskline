import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type EnemyState = 'idle' | 'patrol' | 'investigate' | 'alert' | 'engage' | 'defeated';

interface Drone {
  id: number;
  root: THREE.Group;
  home: THREE.Vector3;
  destination: THREE.Vector3;
  health: number;
  state: EnemyState;
  stateTime: number;
  attackTimer: number;
  charge: number;
  flash: number;
  lens: THREE.Mesh;
  lensMaterial: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  thrusters: THREE.Mesh[];
  rotors: THREE.Group[];
  beam: THREE.Line;
  beamMaterial: THREE.LineBasicMaterial;
  beamTime: number;
  light: THREE.PointLight;
  phase: number;
}

/** Original VIGIL security sentries. All behaviour advances only from update(). */
export class EnemySystem {
  readonly targets: THREE.Object3D[] = [];
  private readonly group = new THREE.Group();
  private readonly drones: Drone[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly proposed = new THREE.Vector3();
  private readonly materials = new Set<THREE.Material>();
  private readonly geometries = new Set<THREE.BufferGeometry>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly surfaces: THREE.Object3D[],
    private readonly onAttack: (damage: number, position: THREE.Vector3) => void,
    private readonly onDefeat: () => void,
  ) {
    this.group.name = 'VIGIL security units';
    scene.add(this.group);
    const locations = [
      [-6, 1.6, -24], [7, 1.6, -35], [0, 1.6, -51],
      [-6, 1.6, -68], [6, 1.6, -88],
    ];
    locations.forEach((location, index) => this.createDrone(index, new THREE.Vector3(...location)));
  }

  get living(): number { return this.drones.filter(drone => drone.health > 0).length; }

  private material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const result = new THREE.MeshStandardMaterial(parameters);
    this.materials.add(result);
    return result;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
    position: [number, number, number] = [0, 0, 0]): THREE.Mesh {
    this.geometries.add(geometry);
    this.materials.add(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private createDrone(id: number, home: THREE.Vector3): void {
    const root = new THREE.Group();
    root.name = `VIGIL–0${id + 1}`;
    root.position.copy(home);
    root.userData.enemyId = id;
    root.userData.state = 'idle';
    this.group.add(root);
    const armor = this.material({ color: 0x495351, metalness: 0.82, roughness: 0.38 });
    const edges = this.material({ color: 0x252b2c, metalness: 0.76, roughness: 0.47 });
    const steel = this.material({ color: 0x88908b, metalness: 0.92, roughness: 0.28 });
    const stripe = this.material({ color: 0xc97e39, metalness: 0.48, roughness: 0.44 });
    const lensMaterial = this.material({ color: 0xff5b42, emissive: 0xff341f, emissiveIntensity: 3.2,
      metalness: 0.3, roughness: 0.15 });
    const blue = this.material({ color: 0x7fcdd2, emissive: 0x2abfc9, emissiveIntensity: 1.8,
      metalness: 0.3, roughness: 0.28 });

    // A bevelled, chamfered carapace rather than a box-shaped target.
    const shape = new THREE.Shape();
    shape.moveTo(-0.33, -0.17);
    shape.lineTo(-0.48, -0.03); shape.lineTo(-0.43, 0.19); shape.lineTo(-0.2, 0.3);
    shape.lineTo(0.2, 0.3); shape.lineTo(0.43, 0.19); shape.lineTo(0.48, -0.03);
    shape.lineTo(0.33, -0.17); shape.closePath();
    const shell = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true,
      bevelSegments: 2, steps: 1, bevelSize: 0.045, bevelThickness: 0.045 }), armor, root, [0, 0, -0.25]);
    shell.name = 'Armoured carapace';
    const upper = this.mesh(new THREE.SphereGeometry(0.37, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), edges,
      root, [0, 0.18, -0.04]);
    upper.scale.set(1.04, 0.28, 0.83);
    this.mesh(new THREE.BoxGeometry(0.33, 0.045, 0.36), stripe, root, [0, 0.325, -0.04]);
    const chin = this.mesh(new THREE.CylinderGeometry(0.19, 0.12, 0.13, 8), steel, root, [0, -0.25, 0]);
    chin.rotation.z = Math.PI;
    this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.33, 8), steel, root, [-0.28, 0.42, -0.15]);
    this.mesh(new THREE.SphereGeometry(0.045, 8, 6), lensMaterial, root, [-0.28, 0.59, -0.15]);

    const gimbal = this.mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.17, 16), edges, root, [0, 0.025, 0.29]);
    gimbal.rotation.x = Math.PI / 2;
    const bezel = this.mesh(new THREE.TorusGeometry(0.125, 0.023, 6, 20), steel, root, [0, 0.025, 0.39]);
    const lens = this.mesh(new THREE.SphereGeometry(0.105, 16, 10), lensMaterial, root, [0, 0.025, 0.405]);
    lens.scale.z = 0.35;
    bezel.name = 'Optical sensor bezel';
    for (let bolt = 0; bolt < 4; bolt++) {
      const angle = bolt * Math.PI / 2 + Math.PI / 4;
      this.mesh(new THREE.SphereGeometry(0.016, 6, 4), steel, root,
        [Math.cos(angle) * 0.235, Math.sin(angle) * 0.16, 0.245]);
    }
    for (let rib = 0; rib < 5; rib++) {
      this.mesh(new THREE.BoxGeometry(0.19, 0.019, 0.025), edges, root, [-0.31, -0.04 + rib * 0.038, 0.225]);
      this.mesh(new THREE.BoxGeometry(0.19, 0.019, 0.025), edges, root, [0.31, -0.04 + rib * 0.038, 0.225]);
    }

    const thrusters: THREE.Mesh[] = [];
    const rotors: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.36, 0.1, 0.13), steel, root, [side * 0.5, 0.04, -0.08]);
      const nacelle = new THREE.Group();
      nacelle.position.set(side * 0.68, -0.03, -0.08);
      root.add(nacelle);
      const shroud = this.mesh(new THREE.TorusGeometry(0.215, 0.053, 8, 20), edges, nacelle);
      shroud.rotation.x = Math.PI / 2;
      const trim = this.mesh(new THREE.TorusGeometry(0.22, 0.013, 5, 20), stripe, nacelle, [0, 0.035, 0]);
      trim.rotation.x = Math.PI / 2;
      this.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.12, 8), steel, nacelle);
      const rotor = new THREE.Group();
      nacelle.add(rotor);
      rotors.push(rotor);
      for (let blade = 0; blade < 3; blade++) {
        const part = this.mesh(new THREE.BoxGeometry(0.16, 0.012, 0.04), armor, rotor, [0.085, 0.018, 0]);
        const pivot = new THREE.Group();
        rotor.add(pivot);
        pivot.add(part);
        pivot.rotation.y = blade * Math.PI * 2 / 3;
      }
      const plume = this.mesh(new THREE.ConeGeometry(0.11, 0.22, 8), blue, nacelle, [0, -0.15, 0]);
      plume.rotation.z = Math.PI;
      thrusters.push(plume);
    }

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd35036, transparent: true, opacity: 0.17,
      depthWrite: false, side: THREE.DoubleSide });
    const ring = this.mesh(new THREE.RingGeometry(0.44, 0.48, 32), ringMaterial, this.group,
      [home.x, 0.035, home.z]);
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    const beamMaterial = new THREE.LineBasicMaterial({ color: 0xff8055, transparent: true, opacity: 0,
      depthWrite: false });
    this.materials.add(beamMaterial);
    const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.geometries.add(beamGeometry);
    const beam = new THREE.Line(beamGeometry, beamMaterial);
    beam.frustumCulled = false;
    this.group.add(beam);
    const light = new THREE.PointLight(0xff3921, 0.7, 2.5, 2);
    light.position.set(0, 0.02, 0.5);
    root.add(light);
    // Bake all non-moving pieces into one mesh per material. Preserve the rotor,
    // lens and thruster nodes for animation while keeping five drones affordable.
    this.batchCarapace(root, [lens, ...thrusters, ...rotors]);
    root.traverse(object => {
      object.userData.enemyId = id;
      if (object instanceof THREE.Mesh) this.targets.push(object);
    });
    this.drones.push({ id, root, home: home.clone(), destination: home.clone(), health: 60,
      state: 'idle', stateTime: id * 0.4, attackTimer: 0, charge: 0, flash: 0,
      lens, lensMaterial, ring, thrusters, rotors, beam, beamMaterial, beamTime: 0, light,
      phase: id * 1.9 });
  }

  private batchCarapace(root: THREE.Group, animated: THREE.Object3D[]): void {
    const dynamic = new Set<THREE.Object3D>();
    animated.forEach(object => object.traverse(child => dynamic.add(child)));
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, { meshes: THREE.Mesh[]; geometries: THREE.BufferGeometry[] }>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || dynamic.has(object) || Array.isArray(object.material)) return;
      let batch = batches.get(object.material);
      if (!batch) { batch = { meshes: [], geometries: [] }; batches.set(object.material, batch); }
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      // glTF-style primitive attributes are consistent across these stock geometries.
      batch.meshes.push(object);
      batch.geometries.push(geometry);
    });
    for (const [material, batch] of batches) {
      const merged = mergeGeometries(batch.geometries);
      batch.geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      this.mesh(merged, material, root).name = 'Batched armoured assembly';
      batch.meshes.forEach(mesh => mesh.removeFromParent());
    }
  }

  private transition(drone: Drone, state: EnemyState): void {
    if (drone.state === state) return;
    drone.state = state;
    drone.stateTime = 0;
    drone.root.userData.state = state;
    drone.charge = 0;
  }

  private unobstructed(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const distance = from.distanceTo(to);
    if (distance < 0.2) return true;
    this.direction.subVectors(to, from).normalize();
    this.raycaster.set(from, this.direction);
    this.raycaster.near = 0.12;
    this.raycaster.far = Math.max(0.12, distance - 0.25);
    return !this.raycaster.intersectObjects(this.surfaces, true).some(hit =>
      hit.object.visible && !hit.object.userData.ignoreLOS && !(hit.object instanceof THREE.Points));
  }

  /** Return true only when a living security unit was hit. */
  hit(object: THREE.Object3D, damage: number): boolean {
    let current: THREE.Object3D | null = object;
    while (current && current.userData.enemyId === undefined) current = current.parent;
    if (!current) return false;
    const drone = this.drones[current.userData.enemyId as number];
    if (!drone || drone.health <= 0 || !Number.isFinite(damage) || damage <= 0) return false;
    drone.health = Math.max(0, drone.health - damage);
    drone.flash = 0.18;
    if (drone.health === 0) {
      this.transition(drone, 'defeated');
      drone.light.intensity = 0;
      drone.ring.visible = false;
      drone.beamMaterial.opacity = 0;
      drone.thrusters.forEach(thruster => { thruster.visible = false; });
      drone.root.userData.defeated = true;
      drone.root.traverse(part => { part.userData.defeated = true; });
      this.onDefeat();
    } else {
      this.transition(drone, 'alert');
      drone.stateTime = 0.4;
    }
    return true;
  }

  /** Noise attracts nearby units; it does not bypass visibility checks. */
  alert(position: THREE.Vector3): void {
    for (const drone of this.drones) {
      if (drone.health <= 0 || drone.root.position.distanceTo(position) > 23 || drone.state === 'engage') continue;
      this.transition(drone, 'investigate');
      drone.destination.copy(position);
      // Each sentry is assigned a small room-local patrol volume.
      drone.destination.x = THREE.MathUtils.clamp(position.x, drone.home.x - 2.5, drone.home.x + 2.5);
      drone.destination.z = THREE.MathUtils.clamp(position.z, drone.home.z - 2.3, drone.home.z + 2.3);
      drone.destination.y = drone.home.y;
    }
  }

  update(delta: number, time: number, player: THREE.Vector3): void {
    const dt = Math.min(Math.max(delta, 0), 0.1);
    for (const drone of this.drones) {
      drone.stateTime += dt;
      drone.flash = Math.max(0, drone.flash - dt);
      drone.beamTime = Math.max(0, drone.beamTime - dt);
      drone.beamMaterial.opacity = drone.beamTime > 0 ? drone.beamTime / 0.12 : 0;
      if (drone.state === 'defeated') {
        drone.root.position.y = THREE.MathUtils.damp(drone.root.position.y, 0.28, 6, dt);
        drone.root.rotation.z = THREE.MathUtils.damp(drone.root.rotation.z, 1.1, 5, dt);
        drone.root.rotation.x = THREE.MathUtils.damp(drone.root.rotation.x, -0.3, 4, dt);
        drone.lensMaterial.emissiveIntensity = THREE.MathUtils.damp(drone.lensMaterial.emissiveIntensity, 0.05, 5, dt);
        continue;
      }

      const position = drone.root.position;
      const distance = position.distanceTo(player);
      // Ray origin is the sensor, not a floor-level collision proxy.
      this.eye.copy(position);
      const seesPlayer = distance < 16 && this.unobstructed(this.eye, player);
      if (seesPlayer && !['alert', 'engage'].includes(drone.state)) this.transition(drone, 'alert');
      if (drone.state === 'alert' && drone.stateTime > 0.7) {
        this.transition(drone, seesPlayer ? 'engage' : 'investigate');
        drone.attackTimer = 0.7;
      }
      if (drone.state === 'engage' && (!seesPlayer || distance > 18)) {
        this.transition(drone, 'investigate');
        drone.destination.copy(position);
      }
      if (drone.state === 'idle' && drone.stateTime > 1.8) this.transition(drone, 'patrol');
      if (drone.state === 'investigate' && drone.stateTime > 4) this.transition(drone, 'patrol');

      if (drone.state === 'patrol') {
        drone.destination.set(drone.home.x + Math.sin(time * 0.32 + drone.phase) * 1.35,
          drone.home.y, drone.home.z + Math.cos(time * 0.24 + drone.phase) * 1.05);
      }
      if (drone.state === 'patrol' || drone.state === 'investigate') {
        this.direction.subVectors(drone.destination, position);
        this.direction.y = 0;
        const travel = this.direction.length();
        if (travel > 0.1) {
          this.direction.normalize();
          this.proposed.copy(position).addScaledVector(this.direction, Math.min(travel, dt * 0.65));
          // Look ahead to avoid sweeping through scenery between patrol points.
          this.eye.copy(position).addScaledVector(this.direction, 0.75);
          if (this.unobstructed(position, this.eye)) position.copy(this.proposed);
          if (!seesPlayer) {
            const heading = Math.atan2(this.direction.x, this.direction.z);
            const difference = Math.atan2(Math.sin(heading - drone.root.rotation.y), Math.cos(heading - drone.root.rotation.y));
            drone.root.rotation.y += difference * Math.min(1, dt * 3);
          }
        }
      }

      if (seesPlayer) {
        const heading = Math.atan2(player.x - position.x, player.z - position.z);
        const difference = Math.atan2(Math.sin(heading - drone.root.rotation.y), Math.cos(heading - drone.root.rotation.y));
        drone.root.rotation.y += difference * Math.min(1, dt * 8);
      }
      if (drone.state === 'engage' && seesPlayer) {
        drone.attackTimer -= dt;
        drone.charge = THREE.MathUtils.clamp(1 - drone.attackTimer / 0.85, 0, 1);
        if (drone.attackTimer <= 0) {
          const beamPositions = drone.beam.geometry.getAttribute('position') as THREE.BufferAttribute;
          beamPositions.setXYZ(0, position.x, position.y + 0.02, position.z);
          beamPositions.setXYZ(1, player.x, player.y - 0.1, player.z);
          beamPositions.needsUpdate = true;
          drone.beamTime = 0.12;
          drone.attackTimer = 1.8;
          drone.charge = 0;
          this.onAttack(6, position.clone());
        }
      }
      const intense = drone.flash > 0 ? 10 : 2 + drone.charge * 7;
      drone.lensMaterial.emissiveIntensity = intense;
      drone.lensMaterial.emissive.setHex(drone.flash > 0 ? 0xffdcb0 : drone.state === 'engage' ? 0xff280c : 0xd84225);
      drone.light.intensity = 0.5 + drone.charge * 2;
      drone.lens.scale.setScalar(1 + drone.charge * 0.15);
      drone.lens.scale.z *= 0.35;
      position.y = drone.home.y + Math.sin(time * 2.2 + drone.phase) * 0.085;
      drone.root.rotation.z = Math.sin(time * 1.5 + drone.phase) * 0.035;
      drone.root.rotation.x = Math.sin(time * 1.1 + drone.phase) * 0.025;
      drone.rotors.forEach((rotor, index) => { rotor.rotation.y += dt * (index ? -30 : 30); });
      drone.thrusters.forEach((thruster, index) => { thruster.scale.y = 0.8 + Math.sin(time * 19 + index) * 0.16; });
      drone.ring.position.set(position.x, 0.035, position.z);
      (drone.ring.material as THREE.MeshBasicMaterial).opacity = drone.state === 'engage' ? 0.3 : 0.14;
      drone.root.updateMatrixWorld(true);
    }
  }

  reset(): void {
    for (const drone of this.drones) {
      drone.root.position.copy(drone.home);
      drone.root.rotation.set(0, 0, 0);
      drone.health = 60;
      drone.state = 'idle';
      drone.stateTime = drone.id * 0.4;
      drone.attackTimer = 0.8;
      drone.charge = drone.flash = drone.beamTime = 0;
      drone.beamMaterial.opacity = 0;
      drone.lensMaterial.emissiveIntensity = 3.2;
      drone.ring.visible = true;
      drone.light.intensity = 0.7;
      drone.thrusters.forEach(thruster => { thruster.visible = true; });
      drone.root.userData.state = 'idle';
      drone.root.traverse(part => { part.userData.defeated = false; });
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.targets.length = 0;
    this.drones.length = 0;
  }
}
