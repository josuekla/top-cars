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
  stats: CarStats;
  isMotorcycle?: boolean;
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

  const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
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

  const tailLightGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
  const leftTailLight = new THREE.Mesh(tailLightGeo, lightRearMat);
  leftTailLight.position.set(-0.65, 0.5, -2.16);

  const rightTailLight = new THREE.Mesh(tailLightGeo, lightRearMat);
  rightTailLight.position.set(0.65, 0.5, -2.16);

  root.add(leftHeadLight, rightHeadLight, leftTailLight, rightTailLight);

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

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), lightRearMat);
  tailLight.position.set(0, 0.7, -1.35);

  root.add(headLight, tailLight);

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
    const targetLean = steerInput * 0.55;
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
  const steerAngle = steerInput * 0.45;
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
