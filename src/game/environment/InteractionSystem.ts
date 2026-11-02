import * as THREE from 'three';

export interface Interactive {
  id: string;
  root: THREE.Object3D;
  label: () => string;
  action: () => void;
  range?: number;
  active?: () => boolean;
}
export class InteractionSystem {
  items: Interactive[] = [];
  current: Interactive | null = null;
  private ray = new THREE.Raycaster();
  constructor(private camera: THREE.PerspectiveCamera, private surfaces: THREE.Object3D[]) {}
  add(item: Interactive) { this.items.push(item); item.root.traverse(o => { o.userData.interactiveId = item.id; }); }
  update() {
    this.current = null;
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.ray.far = 4;
    const active = this.items.filter(i => i.root.visible && (i.active?.() ?? true));
    const hits = this.ray.intersectObjects([...active.map(i => i.root), ...this.surfaces], true).filter(hit => {
      let node: THREE.Object3D | null = hit.object;
      while (node) { if (!node.visible) return false; node = node.parent; }
      return true;
    });
    if (hits.length) {
      const hit = hits[0];
      const item = active.find(i => i.id === hit.object.userData.interactiveId);
      if (item && hit.distance <= (item.range ?? 3.3)) this.current = item;
    }
    return this.current?.label() ?? '';
  }
  interact() { this.update(); this.current?.action(); }
}
