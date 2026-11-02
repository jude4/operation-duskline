import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';

export class PhysicsWorld {
  world!: RAPIER.World;
  body!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;
  controller!: RAPIER.KinematicCharacterController;
  grounded = false;
  crouched = false;
  velocity = new Vector3();
  private jumpRequested = false;
  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = 1 / 60;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.05, 11));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.58, 0.32).setTranslation(0, 0.9, 0).setFriction(0), this.body);
    this.controller = this.world.createCharacterController(0.025);
    this.controller.enableAutostep(0.3, 0.25, true);
    this.controller.enableSnapToGround(0.2);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(80);
  }
  addBox = (center: [number, number, number], size: [number, number, number]) => {
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...center).setFriction(0.6));
  };
  setCrouch(crouched: boolean) {
    if (crouched === this.crouched) return;
    if (!crouched) {
      let blocked = false;
      const p = this.body.translation();
      this.world.intersectionsWithShape({ x: p.x, y: p.y + 1.2, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(0.26, 0.3), () => { blocked = true; return false; }, undefined, undefined, this.collider, this.body);
      if (blocked) return;
    }
    this.crouched = crouched;
    this.collider.setShape(new RAPIER.Capsule(crouched ? 0.25 : 0.58, 0.32));
    this.collider.setTranslationWrtParent({ x: 0, y: crouched ? 0.57 : 0.9, z: 0 });
  }
  jump() { if (this.grounded && !this.crouched) this.jumpRequested = true; }
  step(dt: number, move: Vector3, sprinting: boolean, aiming: boolean) {
    const speed = this.crouched ? 2.1 : aiming ? 2.8 : sprinting ? 7.2 : 4.2;
    const acceleration = this.grounded ? 16 : 5;
    this.velocity.x += (move.x * speed - this.velocity.x) * (1 - Math.exp(-acceleration * dt));
    this.velocity.z += (move.z * speed - this.velocity.z) * (1 - Math.exp(-acceleration * dt));
    if (this.jumpRequested) { this.velocity.y = 7.2; this.grounded = false; this.jumpRequested = false; }
    else if (this.grounded && this.velocity.y < 0) this.velocity.y = -0.5;
    this.velocity.y = Math.max(-30, this.velocity.y - 22 * dt);
    this.controller.computeColliderMovement(this.collider, { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt });
    const m = this.controller.computedMovement();
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -0.5;
    this.world.step();
    if (this.body.translation().y < -6) this.teleport(0, 0.1, 11);
  }
  teleport(x: number, y: number, z: number) {
    this.velocity.set(0, 0, 0);
    this.jumpRequested = false;
    this.body.setTranslation({ x, y, z }, true);
    this.body.setNextKinematicTranslation({ x, y, z });
    this.world.step();
  }
  get position() { const p = this.body.translation(); return new Vector3(p.x, p.y, p.z); }
  dispose() { this.world?.free(); }
}
export { RAPIER };
