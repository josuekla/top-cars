import * as THREE from 'three';
import { ALL_CARS, type CarStats } from '../core';
import { createCarMesh, updateCarMesh, type CarMeshInstance } from './carMesh';

export class CarShowcase {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private currentMeshInstance: CarMeshInstance | null = null;
  private turntableGroup: THREE.Group;
  private animFrameId: number | null = null;
  private rotationAngle: number = 0;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 180;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();

    // Iluminação de estúdio retrô
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffe6aa, 2.5);
    keyLight.position.set(5, 8, 5);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00d2ff, 1.8);
    rimLight.position.set(-5, 4, -5);
    this.scene.add(rimLight);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    this.camera.position.set(0, 2.8, 6.2);
    this.camera.lookAt(0, 0.4, 0);

    // Plataforma Giratória (Turntable)
    this.turntableGroup = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.25, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x121726,
      metalness: 0.8,
      roughness: 0.2,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.125;

    const ringGeo = new THREE.TorusGeometry(2.35, 0.06, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.01;

    this.turntableGroup.add(baseMesh, ringMesh);
    this.scene.add(this.turntableGroup);

    this.setCar(ALL_CARS[0]);
  }

  public setCar(stats: CarStats): void {
    if (this.currentMeshInstance) {
      this.turntableGroup.remove(this.currentMeshInstance.root);
      this.currentMeshInstance = null;
    }

    this.currentMeshInstance = createCarMesh(stats);
    this.turntableGroup.add(this.currentMeshInstance.root);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!this.isRunning) return;
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      this.rotationAngle += dt * 0.9;
      this.turntableGroup.rotation.y = this.rotationAngle;

      if (this.currentMeshInstance) {
        // Animação leve de suspensão
        const dummyState = {
          x: 0,
          y: 0,
          angle: 0,
          speed: 0,
          lateralVelocity: 0,
          fuel: 100,
          nitroTimer: 0,
          isOutOfFuel: false,
          surface: 'asphalt' as const,
        };
        updateCarMesh(this.currentMeshInstance, dummyState, 0, dt);
      }

      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public destroy(): void {
    this.stop();
    this.renderer.dispose();
  }
}
