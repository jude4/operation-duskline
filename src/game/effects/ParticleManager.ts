import * as THREE from 'three';

/** A fixed pool shared by all impacts. No allocation per frame or unbounded decals. */
export class ParticleManager {
  private sparks: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private cursor = 0;
  private decalCursor = 0;
  private geometry = new THREE.SphereGeometry(0.025, 4, 3);
  private material = new THREE.MeshBasicMaterial({ color: 0xffb95d, toneMapped: false });
  private decalGeometry = new THREE.CircleGeometry(0.045, 8);
  private decalMaterial = new THREE.MeshBasicMaterial({ color: 0x172024, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material); mesh.visible = false; scene.add(mesh);
      this.sparks.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    for (let i = 0; i < 32; i++) { const m = new THREE.Mesh(this.decalGeometry, this.decalMaterial); m.visible = false; scene.add(m); this.decals.push(m); }
  }
  impact(position: THREE.Vector3, normal: THREE.Vector3, mark = true) {
    for (let i = 0; i < 7; i++) {
      const p = this.sparks[this.cursor++ % this.sparks.length];
      p.mesh.visible = true; p.mesh.position.copy(position).addScaledVector(normal, 0.03);
      p.velocity.set((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3).addScaledVector(normal, 2);
      p.life = 0.15 + Math.random() * 0.2;
    }
    if (mark) {
      const d = this.decals[this.decalCursor++ % this.decals.length];
      d.visible = true; d.position.copy(position).addScaledVector(normal, 0.012);
      d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    }
  }
  update(dt: number) {
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt; p.mesh.visible = p.life > 0;
      p.velocity.y -= dt * 8; p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(0.1, p.life * 3));
    }
  }
  reset() { this.sparks.forEach(p => { p.life = 0; p.mesh.visible = false; }); this.decals.forEach(d => d.visible = false); }
  dispose() { [...this.sparks.map(p => p.mesh), ...this.decals].forEach(m => this.scene.remove(m)); this.geometry.dispose(); this.material.dispose(); this.decalGeometry.dispose(); this.decalMaterial.dispose(); }
}
