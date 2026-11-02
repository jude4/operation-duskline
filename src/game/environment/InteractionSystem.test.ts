import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InteractionSystem } from './InteractionSystem';

const scenes: THREE.Scene[] = [];
afterEach(() => {
  scenes.splice(0).forEach(scene => scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    }
  }));
});

function fixture(distance = 2) {
  const scene = new THREE.Scene(); scenes.push(scene);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.03, 100);
  scene.add(camera);
  const surfaces: THREE.Object3D[] = [];
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.2), new THREE.MeshBasicMaterial());
  target.position.z = -distance;
  scene.add(target);
  const action = vi.fn();
  let enabled = true;
  const system = new InteractionSystem(camera, surfaces);
  system.add({ id: 'terminal', root: target, label: () => 'RECOVER DATA', action, active: () => enabled });
  const wall = (parent: THREE.Object3D = scene) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshBasicMaterial());
    mesh.position.z = -1;
    parent.add(mesh);
    return mesh;
  };
  return { scene, camera, surfaces, target, system, action, wall,
    disable: () => { enabled = false; },
    update: () => { scene.updateMatrixWorld(true); return system.update(); },
  };
}

describe('Context interactions use actual Three.js aiming and occlusion', () => {
  it('selects the aimed object in reach and invokes its action on interact', () => {
    const f = fixture();
    expect(f.update()).toBe('RECOVER DATA');
    expect(f.system.current?.id).toBe('terminal');
    expect(f.action).not.toHaveBeenCalled();
    f.system.interact();
    expect(f.action).toHaveBeenCalledTimes(1);
  });

  it('does not interact through a visible opaque wall', () => {
    const f = fixture();
    f.surfaces.push(f.wall());
    expect(f.update()).toBe('');
    f.system.interact();
    expect(f.action).not.toHaveBeenCalled();
  });

  it('ignores a broken or hidden surface in front of an interaction', () => {
    const f = fixture();
    const brokenGlass = f.wall();
    brokenGlass.visible = false;
    f.surfaces.push(brokenGlass);
    expect(f.update()).toBe('RECOVER DATA');
    f.system.interact();
    expect(f.action).toHaveBeenCalledTimes(1);
  });

  it('ignores an occluder whose parent is hidden even when the mesh itself is visible', () => {
    const f = fixture();
    const parent = new THREE.Group();
    parent.visible = false;
    f.scene.add(parent);
    const hiddenDoor = f.wall(parent);
    expect(hiddenDoor.visible).toBe(true);
    // Engine surfaces may contain leaf meshes instead of whole groups.
    f.surfaces.push(hiddenDoor);
    expect(f.update()).toBe('RECOVER DATA');
    f.system.interact();
    expect(f.action).toHaveBeenCalledTimes(1);
  });

  it('does not invoke actions on objects beyond reach', () => {
    const f = fixture(3.8);
    expect(f.update()).toBe('');
    f.system.interact();
    expect(f.action).not.toHaveBeenCalled();
    f.target.position.z = -8;
    expect(f.update()).toBe('');
  });

  it('clears the prompt after looking away and cannot invoke a stale target', () => {
    const f = fixture();
    expect(f.update()).toBe('RECOVER DATA');
    f.camera.rotation.y = Math.PI / 2;
    expect(f.update()).toBe('');
    expect(f.system.current).toBeNull();
    f.system.interact();
    expect(f.action).not.toHaveBeenCalled();
  });

  it('does not select disabled items or invoke their actions from an earlier prompt', () => {
    const f = fixture();
    expect(f.update()).toBe('RECOVER DATA');
    f.disable();
    expect(f.update()).toBe('');
    f.system.interact();
    expect(f.action).not.toHaveBeenCalled();
  });

  it('does not select a hidden pickup', () => {
    const f = fixture();
    f.target.visible = false;
    expect(f.update()).toBe('');
    f.system.interact();
    expect(f.action).not.toHaveBeenCalled();
  });
});
