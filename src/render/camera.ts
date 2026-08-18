import * as THREE from 'three';
import type { VehicleState, CarStats } from '../core';

export interface ChaseCameraOptions {
  distance?: number;
  height?: number;
  lookAhead?: number;
  damping?: number;
  baseFov?: number;
  maxFovBonus?: number;
}

export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPosition: THREE.Vector3;
  private currentLookAt: THREE.Vector3;
  private targetFov: number;
  private options: Required<ChaseCameraOptions>;

  constructor(options: ChaseCameraOptions = {}) {
    this.options = {
      distance: options.distance ?? 8.5,
      height: options.height ?? 3.4,
      lookAhead: options.lookAhead ?? 12.0,
      damping: options.damping ?? 0.08,
      baseFov: options.baseFov ?? 62,
      maxFovBonus: options.maxFovBonus ?? 18,
    };

    this.camera = new THREE.PerspectiveCamera(
      this.options.baseFov,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.currentPosition = new THREE.Vector3(0, 5, -10);
    this.currentLookAt = new THREE.Vector3(0, 0, 0);
    this.targetFov = this.options.baseFov;

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };

  public update(state: VehicleState, stats: CarStats, dt: number): void {
    // Vetores de orientação do carro em 3D
    // angle 0 -> +X, angle PI/2 -> +Y (3D Z)
    const forwardX = Math.cos(state.angle);
    const forwardZ = Math.sin(state.angle);

    // Posição ideal atrás do veículo
    const idealX = state.x - forwardX * this.options.distance;
    const idealZ = state.y - forwardZ * this.options.distance;
    const idealY = this.options.height;

    // Alvo de foco à frente do veículo
    const lookX = state.x + forwardX * this.options.lookAhead;
    const lookZ = state.y + forwardZ * this.options.lookAhead;
    const lookY = 1.0;

    // Interpolação suave (lerp amortecido pelo deltaTime)
    const smoothFactor = 1 - Math.pow(1 - this.options.damping, dt * 60);

    this.currentPosition.lerp(new THREE.Vector3(idealX, idealY, idealZ), smoothFactor);
    this.currentLookAt.lerp(new THREE.Vector3(lookX, lookY, lookZ), smoothFactor * 1.5);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);

    // FOV dinâmico pela velocidade e boost de nitro
    const speedRatio = Math.min(1.2, Math.max(0, state.speed / stats.topSpeed));
    let desiredFov = this.options.baseFov + speedRatio * this.options.maxFovBonus;

    if (state.nitroTimer > 0) {
      desiredFov += 8.0; // Nitro FOV kick
    }

    this.targetFov += (desiredFov - this.targetFov) * smoothFactor * 2;
    this.camera.fov = this.targetFov;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
  }
}
