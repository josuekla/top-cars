import * as THREE from 'three';
import type { Track, TrackPoint } from '../track';

export interface PitMeshInstance {
  group: THREE.Group;
  beacons: THREE.Mesh[];
  pulsingLights: THREE.PointLight[];
}

export function createPitMesh(track: Track): THREE.Group {
  const instance = createPitMeshInstance(track);
  return instance.group;
}

export function createPitMeshInstance(track: Track): PitMeshInstance {
  const group = new THREE.Group();
  const beacons: THREE.Mesh[] = [];
  const pulsingLights: THREE.PointLight[] = [];

  const pitDef = track.definition.pitLane;
  if (!pitDef) return { group, beacons, pulsingLights };

  const points = track.points;
  const count = points.length;

  const pitPositions: number[] = [];
  const pitIndices: number[] = [];
  const hazardPositions: number[] = [];
  const hazardColors: number[] = [];
  const hazardIndices: number[] = [];

  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < count; i++) {
    const pt = points[i];
    if (pt.distance >= pitDef.startDistance && pt.distance <= pitDef.endDistance) {
      if (startIndex === -1) startIndex = i;
      endIndex = i;
    }
  }

  if (startIndex === -1 || endIndex === -1) return { group, beacons, pulsingLights };

  // 1. Faixa de Asfalto do Pit Lane + Marcações de Perigo/Hazard
  let vCount = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const pt = points[i];
    const halfW = pt.width / 2;
    const sideSign = pitDef.side === 'left' ? 1 : -1;

    const innerX = pt.x + pt.normalX * (halfW * sideSign);
    const innerZ = pt.y + pt.normalY * (halfW * sideSign);

    const outerX = pt.x + pt.normalX * ((halfW + pitDef.width) * sideSign);
    const outerZ = pt.y + pt.normalY * ((halfW + pitDef.width) * sideSign);

    pitPositions.push(innerX, 0.055, innerZ);
    pitPositions.push(outerX, 0.055, outerZ);

    if (i < endIndex) {
      const p1 = vCount * 2;
      const p2 = vCount * 2 + 1;
      const p3 = (vCount + 1) * 2;
      const p4 = (vCount + 1) * 2 + 1;

      pitIndices.push(p1, p2, p3);
      pitIndices.push(p2, p4, p3);
    }

    // Borda amarela/preta do pit stop (hazard stripe)
    const isYellow = Math.floor(pt.distance / 2) % 2 === 0;
    const r = isYellow ? 0.95 : 0.1;
    const g = isYellow ? 0.8 : 0.1;
    const b = 0.1;

    const hOuterX = pt.x + pt.normalX * ((halfW + pitDef.width + 0.8) * sideSign);
    const hOuterZ = pt.y + pt.normalY * ((halfW + pitDef.width + 0.8) * sideSign);

    const hIdx = hazardPositions.length / 3;
    hazardPositions.push(outerX, 0.065, outerZ);
    hazardPositions.push(hOuterX, 0.065, hOuterZ);
    hazardColors.push(r, g, b, r, g, b);

    if (i < endIndex) {
      hazardIndices.push(hIdx, hIdx + 1, hIdx + 2);
      hazardIndices.push(hIdx + 1, hIdx + 3, hIdx + 2);
    }

    vCount++;
  }

  // 1. Mesh da Pista do Pit
  const pitGeo = new THREE.BufferGeometry();
  pitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pitPositions, 3));
  pitGeo.setIndex(pitIndices);
  pitGeo.computeVertexNormals();

  const pitMat = new THREE.MeshStandardMaterial({
    color: 0x222a36,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const pitMesh = new THREE.Mesh(pitGeo, pitMat);
  pitMesh.receiveShadow = true;
  group.add(pitMesh);

  // 2. Mesh das Listras Amarelas de Alerta
  const hazardGeo = new THREE.BufferGeometry();
  hazardGeo.setAttribute('position', new THREE.Float32BufferAttribute(hazardPositions, 3));
  hazardGeo.setAttribute('color', new THREE.Float32BufferAttribute(hazardColors, 3));
  hazardGeo.setIndex(hazardIndices);
  hazardGeo.computeVertexNormals();

  const hazardMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const hazardMesh = new THREE.Mesh(hazardGeo, hazardMat);
  group.add(hazardMesh);

  // 3. Edifício de Boxes Principal com Iluminação e Tenda
  const midIndex = Math.floor((startIndex + endIndex) / 2);
  const midPt = points[midIndex];
  const sideSign = pitDef.side === 'left' ? 1 : -1;
  const boxX = midPt.x + midPt.normalX * ((midPt.width / 2 + pitDef.width + 6) * sideSign);
  const boxZ = midPt.y + midPt.normalY * ((midPt.width / 2 + pitDef.width + 6) * sideSign);

  createPitGarageBuilding(group, boxX, boxZ, midPt, beacons, pulsingLights);

  // 4. Pórtico de Entrada Luminoso "ENTRADA PIT ➔" + Feixe Holográfico
  const startPt = points[startIndex];
  createPitEntryGantry(group, startPt, pitDef.width, sideSign, beacons, pulsingLights);

  // 5. Cones de Sinalização Laranjas na entrada
  createTrafficCones(group, startPt, sideSign);

  return { group, beacons, pulsingLights };
}

function createPitGarageBuilding(
  parent: THREE.Group,
  boxX: number,
  boxZ: number,
  midPt: TrackPoint,
  beacons: THREE.Mesh[],
  pulsingLights: THREE.PointLight[]
): void {
  const garageGroup = new THREE.Group();

  // Prédio dos boxes (Garagens)
  const garageGeo = new THREE.BoxGeometry(10, 5, 45);
  const garageMat = new THREE.MeshStandardMaterial({
    color: 0x1f2430,
    roughness: 0.4,
    metalness: 0.3,
  });
  const garage = new THREE.Mesh(garageGeo, garageMat);
  garage.position.set(0, 2.5, 0);
  garage.castShadow = true;
  garage.receiveShadow = true;

  // Teto estendido dos boxes (Toldo vermelho/branco)
  const roofGeo = new THREE.BoxGeometry(14, 0.4, 46);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(-2, 5.2, 0);
  roof.castShadow = true;

  // Letreiro Neon Gigante "⛽ PIT STOP — REFUEL"
  const signGeo = new THREE.BoxGeometry(1.2, 2.4, 26);
  const signMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffa500,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(-6.5, 7.0, 0);

  // Aura de Brilho Neon Volumétrico (Glow Halo)
  const glowGeo = new THREE.PlaneGeometry(30, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const glowHalo = new THREE.Mesh(glowGeo, glowMat);
  glowHalo.position.set(-6.8, 7.0, 0);
  glowHalo.rotation.y = Math.PI / 2;
  beacons.push(glowHalo);

  // Feixe de Luz Holográfico no Céu (Sky Beacon gigante)
  const beamGeo = new THREE.CylinderGeometry(1.2, 3.5, 120, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const skyBeam = new THREE.Mesh(beamGeo, beamMat);
  skyBeam.position.set(-6.5, 60, 0);
  beacons.push(skyBeam);

  // Luzes dos Boxes (PointLights quentes potentes)
  const pitLight1 = new THREE.PointLight(0xffaa00, 5.0, 40);
  pitLight1.position.set(-4, 4.5, -14);
  const pitLight2 = new THREE.PointLight(0xffaa00, 6.0, 45);
  pitLight2.position.set(-4, 4.5, 0);
  const pitLight3 = new THREE.PointLight(0xffaa00, 5.0, 40);
  pitLight3.position.set(-4, 4.5, 14);

  pulsingLights.push(pitLight1, pitLight2, pitLight3);

  garageGroup.add(garage, roof, sign, glowHalo, skyBeam, pitLight1, pitLight2, pitLight3);

  garageGroup.position.set(boxX, 0, boxZ);
  garageGroup.rotation.y = -midPt.angle + Math.PI / 2;

  parent.add(garageGroup);
}

function createPitEntryGantry(
  parent: THREE.Group,
  startPt: TrackPoint,
  pitWidth: number,
  sideSign: number,
  beacons: THREE.Mesh[],
  pulsingLights: THREE.PointLight[]
): void {
  const gantry = new THREE.Group();
  const halfW = startPt.width / 2;

  const posX = startPt.x + startPt.normalX * ((halfW + pitWidth / 2) * sideSign);
  const posZ = startPt.y + startPt.normalY * ((halfW + pitWidth / 2) * sideSign);

  // Pilar e arco
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, metalness: 0.8, roughness: 0.2 });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), frameMat);
  leftLeg.position.set(-pitWidth / 2 - 0.5, 3.5, 0);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), frameMat);
  rightLeg.position.set(pitWidth / 2 + 0.5, 3.5, 0);

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(pitWidth + 2, 1.4, 0.8), frameMat);
  topBeam.position.set(0, 7, 0);

  // Placa luminosa "⛽ ENTRADA PIT ➔"
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 2.5,
  });
  const neonSign = new THREE.Mesh(new THREE.BoxGeometry(pitWidth + 1.4, 1.1, 0.9), neonMat);
  neonSign.position.set(0, 7, 0);

  // Feixe vertical de luz ciano no céu indicando a entrada
  const entryBeamGeo = new THREE.CylinderGeometry(0.8, 2.0, 90, 16, 1, true);
  const entryBeamMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const entryBeam = new THREE.Mesh(entryBeamGeo, entryBeamMat);
  entryBeam.position.set(0, 45, 0);
  beacons.push(entryBeam);

  // Luz spot na entrada do pit lane
  const entryLight = new THREE.PointLight(0x00ffff, 6.0, 30);
  entryLight.position.set(0, 5.0, 0);
  pulsingLights.push(entryLight);

  gantry.add(leftLeg, rightLeg, topBeam, neonSign, entryBeam, entryLight);
  gantry.position.set(posX, 0, posZ);
  gantry.rotation.y = -startPt.angle + Math.PI / 2;

  parent.add(gantry);
}

function createTrafficCones(
  parent: THREE.Group,
  startPt: TrackPoint,
  sideSign: number
): void {
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const halfW = startPt.width / 2;

  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), coneMat);
    const offset = halfW * sideSign + (i * 0.75 * sideSign);
    cone.position.set(
      startPt.x + startPt.normalX * offset,
      0.45,
      startPt.y + startPt.normalY * offset
    );
    parent.add(cone);
  }
}

export function updatePitGlow(instance: PitMeshInstance, time: number): void {
  const pulse = 0.8 + Math.sin(time * 4) * 0.25;

  for (const beacon of instance.beacons) {
    if (beacon.material instanceof THREE.MeshBasicMaterial) {
      beacon.material.opacity = 0.35 * pulse;
    }
  }

  for (const light of instance.pulsingLights) {
    light.intensity = 5.0 * pulse;
  }
}
