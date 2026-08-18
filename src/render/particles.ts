import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public group: THREE.Group;
  private particles: Particle[] = [];
  private maxParticles: number = 400;

  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private pointsMesh: THREE.Points;

  constructor() {
    this.group = new THREE.Group();

    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geometry, material);
    this.group.add(this.pointsMesh);
  }

  public emitSparks(x: number, y: number, z: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          2 + Math.random() * 5,
          Math.sin(angle) * speed
        ),
        color: new THREE.Color(Math.random() > 0.3 ? 0xffcc00 : 0xff3300),
        size: 0.4 + Math.random() * 0.4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }

  public emitTireSmoke(x: number, y: number, z: number, isGrass: boolean = false): void {
    if (this.particles.length >= this.maxParticles) return;
    const color = isGrass
      ? new THREE.Color(0x8a6d3b) // Poeira de terra/grama
      : new THREE.Color(0xcccccc); // Fumaça branca de pneu

    this.particles.push({
      position: new THREE.Vector3(
        x + (Math.random() - 0.5) * 0.4,
        y + 0.1,
        z + (Math.random() - 0.5) * 0.4
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        0.8 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.2
      ),
      color,
      size: 0.6 + Math.random() * 0.6,
      alpha: 0.6,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
    });
  }

  public update(dt: number): void {
    let aliveCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life < p.maxLife) {
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= 9.8 * dt * 0.3; // Gravidade leve

        const progress = p.life / p.maxLife;
        p.alpha = 1 - progress;

        const idx = aliveCount * 3;
        this.positions[idx] = p.position.x;
        this.positions[idx + 1] = p.position.y;
        this.positions[idx + 2] = p.position.z;

        this.colors[idx] = p.color.r * p.alpha;
        this.colors[idx + 1] = p.color.g * p.alpha;
        this.colors[idx + 2] = p.color.b * p.alpha;

        this.sizes[aliveCount] = p.size * (1 + progress * 1.5);
        this.particles[aliveCount] = p;
        aliveCount++;
      }
    }

    this.particles.length = aliveCount;

    // Zera os pontos inativos
    for (let i = aliveCount; i < this.maxParticles; i++) {
      this.sizes[i] = 0;
      this.positions[i * 3 + 1] = -9999;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}
