import * as THREE from 'three';
import type { CarStats, VehicleState } from '../core';

export interface CarMeshInstance {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  nitroFlames: THREE.Mesh[];
  spotLight?: THREE.SpotLight;
  headlightBeam?: THREE.Mesh;
  stats: CarStats;
  isMotorcycle?: boolean;
}

let cachedBeamTexture: THREE.CanvasTexture | null = null;
function getHeadlightBeamTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  if (cachedBeamTexture) return cachedBeamTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, 'rgba(255, 255, 235, 0.85)');
  grad.addColorStop(0.18, 'rgba(255, 250, 205, 0.65)');
  grad.addColorStop(0.55, 'rgba(255, 240, 180, 0.25)');
  grad.addColorStop(1.0, 'rgba(255, 240, 180, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  cachedBeamTexture = new THREE.CanvasTexture(canvas);
  cachedBeamTexture.wrapS = THREE.ClampToEdgeWrapping;
  cachedBeamTexture.wrapT = THREE.ClampToEdgeWrapping;
  return cachedBeamTexture;
}

let cachedCyanBeamTexture: THREE.CanvasTexture | null = null;
function getCyanHeadlightBeamTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  if (cachedCyanBeamTexture) return cachedCyanBeamTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, 'rgba(130, 245, 255, 0.85)');
  grad.addColorStop(0.18, 'rgba(80, 220, 255, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 200, 255, 0.25)');
  grad.addColorStop(1.0, 'rgba(0, 180, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  cachedCyanBeamTexture = new THREE.CanvasTexture(canvas);
  cachedCyanBeamTexture.wrapS = THREE.ClampToEdgeWrapping;
  cachedCyanBeamTexture.wrapT = THREE.ClampToEdgeWrapping;
  return cachedCyanBeamTexture;
}

function createHeadlightGroundBeam(isMotorcycle: boolean = false): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const nearZ = isMotorcycle ? 1.4 : 2.16;
  const farZ = isMotorcycle ? 26.0 : 32.0;
  const nearW = isMotorcycle ? 0.8 : 2.0;
  const farW = isMotorcycle ? 6.8 : 10.5;
  const y = 0.058;

  const positions = [
    -nearW / 2, y, nearZ,
    nearW / 2, y, nearZ,
    -farW / 2, y, farZ,
    farW / 2, y, farZ,
  ];

  const uvs = [
    0, 0,
    1, 0,
    0, 1,
    1, 1,
  ];

  const indices = [
    0, 1, 2,
    1, 3, 2,
  ];

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const beamTex = isMotorcycle ? getCyanHeadlightBeamTexture() : getHeadlightBeamTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: beamTex,
    color: isMotorcycle ? 0x80ffff : 0xfffae6,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

function createVolumetricBeam(
  startX: number,
  startY: number,
  startZ: number,
  length: number = 22,
  color: number = 0xfffae6
): THREE.Mesh {
  const coneGeo = new THREE.CylinderGeometry(0.12, 1.8, length, 12, 1, true);
  coneGeo.rotateX(Math.PI / 2);
  coneGeo.translate(0, 0, length / 2);

  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(coneGeo, mat);
  mesh.position.set(startX, startY, startZ);
  mesh.rotation.x = 0.02; // Leve inclinação para baixo em direção à estrada
  return mesh;
}

function createHeadlightLensGlow(x: number, y: number, z: number, color: number = 0xffffff): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(0.55, 0.4);
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(geo, mat);
  glow.position.set(x, y, z + 0.02);
  return glow;
}

export function createCarMesh(stats: CarStats): CarMeshInstance {
  if (stats.id === 'night_viper') {
    return createMotorcycleMesh(stats);
  }

  const root = new THREE.Group();

  // Materiais
  const bodyMat = new THREE.MeshStandardMaterial({
    color: stats.color,
    roughness: 0.25,
    metalness: 0.65,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x111e2e,
    roughness: 0.1,
    metalness: 0.9,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.7,
  });

  const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
  const lightRearMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });

  // 1. Chassi Inferior do Carro
  const lowerBodyGeo = new THREE.BoxGeometry(2.0, 0.45, 4.4);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
  lowerBody.position.y = 0.45;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  root.add(lowerBody);

  // Cabine / Teto Esportivo
  const cabinGeo = new THREE.BoxGeometry(1.5, 0.45, 2.2);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.85, -0.2);
  cabin.castShadow = true;
  root.add(cabin);

  // Spoiler Traseiro
  const spoilerWingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
  const spoilerWing = new THREE.Mesh(spoilerWingGeo, bodyMat);
  spoilerWing.position.set(0, 1.0, -1.9);
  spoilerWing.castShadow = true;

  const spoilerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), trimMat);
  spoilerPostL.position.set(-0.6, 0.8, -1.9);

  const spoilerPostR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), trimMat);
  spoilerPostR.position.set(0.6, 0.8, -1.9);

  root.add(spoilerWing, spoilerPostL, spoilerPostR);

  // Faróis Dianteiros e Lanternas Traseiras
  const headLightGeo = new THREE.BoxGeometry(0.35, 0.12, 0.1);
  const leftHeadLight = new THREE.Mesh(headLightGeo, lightFrontMat);
  leftHeadLight.position.set(-0.7, 0.45, 2.16);

  const rightHeadLight = new THREE.Mesh(headLightGeo, lightFrontMat);
  rightHeadLight.position.set(0.7, 0.45, 2.16);

  const leftFlare = createHeadlightLensGlow(-0.7, 0.45, 2.16, 0xffffff);
  const rightFlare = createHeadlightLensGlow(0.7, 0.45, 2.16, 0xffffff);

  const tailLightGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
  const leftTailLight = new THREE.Mesh(tailLightGeo, lightRearMat);
  leftTailLight.position.set(-0.65, 0.5, -2.16);

  const rightTailLight = new THREE.Mesh(tailLightGeo, lightRearMat);
  rightTailLight.position.set(0.65, 0.5, -2.16);

  root.add(leftHeadLight, rightHeadLight, leftFlare, rightFlare, leftTailLight, rightTailLight);

  // Faróis Ativos (SpotLight 3D real + Feixe Luminoso de Asfalto + Cone Volumétrico)
  const spotLight = new THREE.SpotLight(0xfffae6, 11.0, 45, Math.PI / 5, 0.6, 1.2);
  spotLight.position.set(0, 0.6, 2.15);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0.05, 24.0);
  root.add(spotTarget);
  spotLight.target = spotTarget;
  root.add(spotLight);

  const groundBeam = createHeadlightGroundBeam(false);
  root.add(groundBeam);

  const volBeamL = createVolumetricBeam(-0.7, 0.45, 2.16, 20, 0xfffae6);
  const volBeamR = createVolumetricBeam(0.7, 0.45, 2.16, 20, 0xfffae6);
  root.add(volBeamL, volBeamR);

  // 2. Rodas
  const createWheel = () => {
    const wheelGroup = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
    tireGeo.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;

    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);

    wheelGroup.add(tire, rim);
    return wheelGroup;
  };

  const frontLeftWheel = createWheel();
  frontLeftWheel.position.set(-1.0, 0.38, 1.3);

  const frontRightWheel = createWheel();
  frontRightWheel.position.set(1.0, 0.38, 1.3);

  const rearLeftWheel = createWheel();
  rearLeftWheel.position.set(-1.0, 0.38, -1.3);

  const rearRightWheel = createWheel();
  rearRightWheel.position.set(1.0, 0.38, -1.3);

  root.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  // 3. Chamas de Nitro no escapamento
  const nitroMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.9,
  });
  const nitroGeo = new THREE.ConeGeometry(0.12, 0.9, 8);
  nitroGeo.rotateX(-Math.PI / 2);

  const nitroLeft = new THREE.Mesh(nitroGeo, nitroMat);
  nitroLeft.position.set(-0.35, 0.3, -2.6);
  nitroLeft.visible = false;

  const nitroRight = new THREE.Mesh(nitroGeo, nitroMat);
  nitroRight.position.set(0.35, 0.3, -2.6);
  nitroRight.visible = false;

  root.add(nitroLeft, nitroRight);

  return {
    root,
    bodyMesh: lowerBody,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    nitroFlames: [nitroLeft, nitroRight],
    spotLight,
    headlightBeam: groundBeam,
    stats,
    isMotorcycle: false,
  };
}

function createMotorcycleMesh(stats: CarStats): CarMeshInstance {
  const root = new THREE.Group();

  const bikeMat = new THREE.MeshStandardMaterial({
    color: stats.color,
    roughness: 0.2,
    metalness: 0.7,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.1 });
  const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const lightRearMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

  // 1. Chassi Aerodinâmico da Moto
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.55, 2.6);
  const bodyMesh = new THREE.Mesh(bodyGeo, bikeMat);
  bodyMesh.position.y = 0.6;
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Carenagem Dianteira e Para-brisa
  const fairingGeo = new THREE.ConeGeometry(0.35, 1.0, 6);
  fairingGeo.rotateX(Math.PI / 2);
  const fairing = new THREE.Mesh(fairingGeo, bikeMat);
  fairing.position.set(0, 0.75, 0.9);
  fairing.castShadow = true;

  const visorGeo = new THREE.BoxGeometry(0.35, 0.3, 0.6);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.95, 0.5);

  // Piloto / Capacete
  const helmetGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const helmet = new THREE.Mesh(helmetGeo, darkMat);
  helmet.position.set(0, 1.25, -0.2);
  helmet.castShadow = true;

  const pilotBodyGeo = new THREE.BoxGeometry(0.45, 0.4, 0.7);
  const pilotBody = new THREE.Mesh(pilotBodyGeo, darkMat);
  pilotBody.position.set(0, 0.95, -0.2);
  pilotBody.rotation.x = 0.25;

  root.add(fairing, visor, helmet, pilotBody);

  // Farol Dianteiro Neon & Lanterna
  const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.1), lightFrontMat);
  headLight.position.set(0, 0.65, 1.45);

  const frontFlare = createHeadlightLensGlow(0, 0.65, 1.45, 0x00ffff);

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), lightRearMat);
  tailLight.position.set(0, 0.7, -1.35);

  root.add(headLight, frontFlare, tailLight);

  // Faróis Ativos da Moto (SpotLight Cyberpunk + Feixe no Asfalto)
  const spotLight = new THREE.SpotLight(0x80ffff, 9.5, 42, Math.PI / 5.2, 0.6, 1.2);
  spotLight.position.set(0, 0.68, 1.45);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0.05, 22.0);
  root.add(spotTarget);
  spotLight.target = spotTarget;
  root.add(spotLight);

  const groundBeam = createHeadlightGroundBeam(true);
  root.add(groundBeam);

  const volBeam = createVolumetricBeam(0, 0.65, 1.45, 20, 0x00ffff);
  root.add(volBeam);

  // 2. Rodas Inline (Dianteira e Traseira)
  const createBikeWheel = () => {
    const wheelGroup = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }));
    tire.castShadow = true;

    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0xff007f, metalness: 0.8 }));

    wheelGroup.add(tire, rim);
    return wheelGroup;
  };

  const frontWheel = createBikeWheel();
  frontWheel.position.set(0, 0.36, 1.1);

  const rearWheel = createBikeWheel();
  rearWheel.position.set(0, 0.36, -1.0);

  root.add(frontWheel, rearWheel);

  // 3. Nitro Flame da Moto
  const nitroMat = new THREE.MeshBasicMaterial({ color: 0xff00aa, transparent: true, opacity: 0.9 });
  const nitroGeo = new THREE.ConeGeometry(0.1, 0.9, 8);
  nitroGeo.rotateX(-Math.PI / 2);

  const nitro = new THREE.Mesh(nitroGeo, nitroMat);
  nitro.position.set(0, 0.45, -1.7);
  nitro.visible = false;
  root.add(nitro);

  return {
    root,
    bodyMesh,
    frontLeftWheel: frontWheel,
    frontRightWheel: frontWheel,
    rearLeftWheel: rearWheel,
    rearRightWheel: rearWheel,
    nitroFlames: [nitro],
    spotLight,
    headlightBeam: groundBeam,
    stats,
    isMotorcycle: true,
  };
}

export function updateCarMesh(
  car: CarMeshInstance,
  state: VehicleState,
  steerInput: number,
  dt: number
): void {
  // Posição 3D
  car.root.position.x = state.x;
  car.root.position.z = state.y;
  car.root.position.y = 0;

  // Rotação Y
  car.root.rotation.y = -state.angle + Math.PI / 2;

  // Inclinação dinâmica (Lean) para a moto nas curvas
  if (car.isMotorcycle) {
    const targetLean = -steerInput * 0.55;
    car.root.rotation.z = THREE.MathUtils.lerp(car.root.rotation.z, targetLean, Math.min(1, dt * 14));
  } else {
    car.root.rotation.z = 0;
  }

  // Rotação das rodas
  const wheelRadius = 0.38;
  const angularSpeed = state.speed / wheelRadius;
  const wheelRotationDelta = angularSpeed * dt;

  if (car.frontLeftWheel.children[0]) car.frontLeftWheel.children[0].rotation.x += wheelRotationDelta;
  if (car.frontRightWheel.children[0]) car.frontRightWheel.children[0].rotation.x += wheelRotationDelta;
  if (car.rearLeftWheel.children[0]) car.rearLeftWheel.children[0].rotation.x += wheelRotationDelta;
  if (car.rearRightWheel.children[0]) car.rearRightWheel.children[0].rotation.x += wheelRotationDelta;

  // Esterçamento das rodas dianteiras
  const steerAngle = -steerInput * 0.45;
  car.frontLeftWheel.rotation.y = steerAngle;
  car.frontRightWheel.rotation.y = steerAngle;

  // Nitro Flames
  const isNitro = state.nitroTimer > 0;
  for (const flame of car.nitroFlames) {
    flame.visible = isNitro;
    if (isNitro) {
      const flicker = 0.8 + Math.random() * 0.4;
      flame.scale.set(flicker, flicker, flicker);
    }
  }
}
