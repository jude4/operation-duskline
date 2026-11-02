import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { EnemySystem } from './EnemySystem';

describe('VIGIL security sentries', () => {
  it('registers damage against a child mesh, defeats exactly once, and resets', () => {
    const onDefeat = vi.fn();
    const system = new EnemySystem(new THREE.Scene(), [], vi.fn(), onDefeat);
    const target = system.targets.find(part => part.userData.enemyId === 0)!;
    expect(system.living).toBe(5);
    expect(system.hit(target, 20)).toBe(true);
    expect(system.hit(target, 20)).toBe(true);
    expect(system.hit(target, 20)).toBe(true);
    expect(system.living).toBe(4);
    expect(system.hit(target, 20)).toBe(false);
    expect(onDefeat).toHaveBeenCalledTimes(1);
    system.reset();
    expect(system.living).toBe(5);
    expect(system.hit(target, 20)).toBe(true);
    system.dispose();
  });

  it('detects and attacks a visible player after the alert windup', () => {
    const attack = vi.fn();
    const scene = new THREE.Scene();
    const system = new EnemySystem(scene, [], attack, vi.fn());
    scene.updateMatrixWorld(true);
    const player = new THREE.Vector3(-6, 1.7, -20);
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60, frame / 60, player);
    expect(attack).toHaveBeenCalled();
    expect(attack.mock.calls.every(call => call[0] === 6)).toBe(true);
    system.dispose();
  });

  it('cannot attack or detect a player through an opaque wall, including after noise', () => {
    const attack = vi.fn();
    const scene = new THREE.Scene();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(100, 10, 1), new THREE.MeshBasicMaterial());
    wall.position.set(0, 2, -22);
    scene.add(wall);
    const system = new EnemySystem(scene, [wall], attack, vi.fn());
    scene.updateMatrixWorld(true);
    const player = new THREE.Vector3(-6, 1.7, -20);
    system.alert(player);
    for (let frame = 0; frame < 360; frame++) system.update(1 / 60, frame / 60, player);
    expect(attack).not.toHaveBeenCalled();
    system.dispose();
    wall.geometry.dispose();
    (wall.material as THREE.Material).dispose();
  });
});
