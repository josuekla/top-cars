import * as THREE from 'three';

export class SkidmarkManager {
  public mesh: THREE.Mesh;
  private maxSegments: number = 300;
  private positions: Float32Array;
  private opacities: Float32Array;
  private geometry: THREE.BufferGeometry;
  private currentSegment: number = 0;
  private totalEmitted: number = 0;

  constructor() {
    // Cada segmento é um quad (4 vértices, 2 triângulos = 6 índices)
    const numVertices = this.maxSegments * 4;
    this.positions = new Float32Array(numVertices * 3);
    this.opacities = new Float32Array(numVertices);

    const indices: number[] = [];
    for (let i = 0; i < this.maxSegments; i++) {
      const v = i * 4;
      indices.push(v, v + 1, v + 2);
      indices.push(v + 1, v + 3, v + 2);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));
    this.geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.y = 0.052;
  }

  public addSkidmark(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    nx: number,
    nz: number,
    width: number = 0.35
  ): void {
    const segIdx = this.currentSegment % this.maxSegments;
    const vIdx = segIdx * 4 * 3;

    const halfW = width / 2;

    // Vértice 0 e 1 (ponto anterior)
    this.positions[vIdx] = x1 + nx * halfW;
    this.positions[vIdx + 1] = 0;
    this.positions[vIdx + 2] = z1 + nz * halfW;

    this.positions[vIdx + 3] = x1 - nx * halfW;
    this.positions[vIdx + 4] = 0;
    this.positions[vIdx + 5] = z1 - nz * halfW;

    // Vértice 2 e 3 (ponto novo)
    this.positions[vIdx + 6] = x2 + nx * halfW;
    this.positions[vIdx + 7] = 0;
    this.positions[vIdx + 8] = z2 + nz * halfW;

    this.positions[vIdx + 9] = x2 - nx * halfW;
    this.positions[vIdx + 10] = 0;
    this.positions[vIdx + 11] = z2 - nz * halfW;

    this.currentSegment++;
    this.totalEmitted++;

    this.geometry.attributes.position.needsUpdate = true;
  }
}
