import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PhysicsWorld, RAPIER } from './PhysicsWorld';

const worlds: PhysicsWorld[] = [];
const still = new Vector3();
const forward = new Vector3(0, 0, -1);
async function setup() {
  const physics = new PhysicsWorld();
  await physics.init();
  worlds.push(physics);
  physics.addBox([0, -0.5, 0], [100, 1, 300]);
  advance(physics, 60);
  return physics;
}
function advance(physics: PhysicsWorld, frames: number, move = still, sprinting = false, aiming = false) {
  for (let i = 0; i < frames; i++) physics.step(1 / 60, move, sprinting, aiming);
}
afterEach(() => { worlds.splice(0).forEach(world => world.dispose()); });

describe('Rapier character movement against actual collision geometry', () => {
  it('settles on solid ground and remains supported under gravity', async () => {
    const physics = await setup();
    expect(physics.grounded).toBe(true);
    const floorHeight = physics.position.y;
    expect(floorHeight).toBeGreaterThanOrEqual(0);
    expect(floorHeight).toBeLessThan(0.08);
    advance(physics, 180);
    expect(physics.position.y).toBeCloseTo(floorHeight, 3);
    expect(physics.grounded).toBe(true);
  });

  it('accelerates, sprints faster than walking, and slows for aiming and crouching', async () => {
    const physics = await setup();
    const distance = (sprint: boolean, aim: boolean, crouch: boolean) => {
      physics.teleport(0, 0.03, 11);
      physics.setCrouch(crouch);
      advance(physics, 2);
      advance(physics, 60, forward, sprint, aim);
      return 11 - physics.position.z;
    };
    const walk = distance(false, false, false);
    const sprint = distance(true, false, false);
    const aim = distance(false, true, false);
    const crouch = distance(false, false, true);
    expect(walk).toBeGreaterThan(3.8);
    expect(sprint).toBeGreaterThan(walk * 1.6);
    expect(aim).toBeLessThan(walk * 0.75);
    expect(crouch).toBeLessThan(aim);
    // Releasing movement should decelerate instead of keeping constant velocity.
    advance(physics, 60);
    expect(Math.abs(physics.velocity.z)).toBeLessThan(0.001);
  });

  it('cannot walk through a tall wall or fall through the supporting floor', async () => {
    const physics = await setup();
    physics.addBox([0, 2, 8], [20, 4, 1]);
    advance(physics, 180, forward, true);
    expect(physics.position.z).toBeGreaterThan(8.8);
    expect(physics.position.z).toBeLessThan(9.1);
    expect(physics.position.y).toBeGreaterThanOrEqual(0);
    expect(physics.grounded).toBe(true);
  });

  it('jumps only while standing on the ground and lands back on it', async () => {
    const physics = await setup();
    const initialHeight = physics.position.y;
    physics.jump();
    advance(physics, 12);
    expect(physics.position.y).toBeGreaterThan(initialHeight + 0.75);
    expect(physics.grounded).toBe(false);
    const airborneVelocity = physics.velocity.y;
    physics.jump();
    advance(physics, 1);
    expect(physics.velocity.y).toBeLessThan(airborneVelocity);
    advance(physics, 90);
    expect(physics.grounded).toBe(true);
    expect(physics.position.y).toBeCloseTo(initialHeight, 2);
    physics.setCrouch(true);
    physics.jump();
    advance(physics, 12);
    // Resizing the capsule may settle it by Rapier's contact tolerance; it must
    // stay on the floor rather than receiving another jump impulse.
    expect(physics.position.y).toBeGreaterThanOrEqual(0);
    expect(physics.position.y).toBeLessThan(initialHeight + 0.04);
    expect(physics.grounded).toBe(true);
  });

  it('fits under a low ceiling when crouched and refuses to stand into it', async () => {
    const physics = await setup();
    physics.setCrouch(true);
    physics.addBox([0, 1.5, 4], [8, 0.3, 8]);
    physics.teleport(0, 0.03, 4);
    advance(physics, 3);
    physics.setCrouch(false);
    expect(physics.crouched).toBe(true);
    physics.teleport(0, 0.03, 11);
    advance(physics, 3);
    physics.setCrouch(false);
    expect(physics.crouched).toBe(false);
    expect(physics.grounded).toBe(true);
  });

  it('pushes a dynamic crate using the character controller impulses', async () => {
    const physics = await setup();
    const crate = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.5, 9)
      .lockRotations().setLinearDamping(1));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.45, 0.5, 0.45).setDensity(4).setFriction(0.5), crate);
    advance(physics, 120, forward);
    expect(crate.translation().z).toBeLessThan(8);
    expect(crate.translation().y).toBeGreaterThan(0.4);
    expect(physics.position.z).toBeLessThan(9);
  });
});
