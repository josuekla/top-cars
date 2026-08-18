import * as THREE from 'three';
import type { Track, TrackPoint } from '../track';

export function createTrackMesh(track: Track): THREE.Group {
  const group = new THREE.Group();
  const points = track.points;
  const count = points.length;

  if (count < 2) return group;

  // 1. Geometria da Pista de Asfalto
  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  // 2. Geometria das Zebras (Kerbs bicolores)
  const kerbPositions: number[] = [];
  const kerbColors: number[] = [];
  const kerbIndices: number[] = [];

  const kerbWidth = 1.6;

  for (let i = 0; i < count; i++) {
    const pt = points[i];
    const halfW = pt.width / 2;

    const leftX = pt.x + pt.normalX * halfW;
    const leftZ = pt.y + pt.normalY * halfW;

    const rightX = pt.x - pt.normalX * halfW;
    const rightZ = pt.y - pt.normalY * halfW;

    // Vértices da pista (Left = 2i, Right = 2i + 1)
    roadPositions.push(leftX, 0.05, leftZ);
    roadPositions.push(rightX, 0.05, rightZ);

    roadNormals.push(0, 1, 0);
    roadNormals.push(0, 1, 0);

    const v = pt.distance * 0.05;
    roadUvs.push(0, v);
    roadUvs.push(1, v);

    // Zebras externas
    const kLeftOuterX = pt.x + pt.normalX * (halfW + kerbWidth);
    const kLeftOuterZ = pt.y + pt.normalY * (halfW + kerbWidth);

    const kRightOuterX = pt.x - pt.normalX * (halfW + kerbWidth);
    const kRightOuterZ = pt.y - pt.normalY * (halfW + kerbWidth);

    // Cor das zebras alternando a cada 4 metros (Vermelho / Branco)
    const isRed = Math.floor(pt.distance / 4) % 2 === 0;
    const r = isRed ? 0.95 : 0.95;
    const g = isRed ? 0.15 : 0.95;
    const b = isRed ? 0.15 : 0.95;

    // 4 vértices por ponto nas zebras: 4i = LOut, 4i+1 = LIn, 4i+2 = RIn, 4i+3 = ROut
    kerbPositions.push(kLeftOuterX, 0.07, kLeftOuterZ);
    kerbPositions.push(leftX, 0.07, leftZ);
    kerbColors.push(r, g, b, r, g, b);

    kerbPositions.push(rightX, 0.07, rightZ);
    kerbPositions.push(kRightOuterX, 0.07, kRightOuterZ);
    kerbColors.push(r, g, b, r, g, b);

    // Triângulos da pista conectando ponto i ao ponto nextI
    const nextI = (i + 1) % count;
    const currentRoadL = i * 2;
    const currentRoadR = i * 2 + 1;
    const nextRoadL = nextI * 2;
    const nextRoadR = nextI * 2 + 1;

    roadIndices.push(currentRoadL, currentRoadR, nextRoadL);
    roadIndices.push(currentRoadR, nextRoadR, nextRoadL);

    // Triângulos das Zebras
    const kIdx = i * 4;
    const nextKIdx = nextI * 4;

    // Zebra esquerda
    kerbIndices.push(kIdx, kIdx + 1, nextKIdx);
    kerbIndices.push(kIdx + 1, nextKIdx + 1, nextKIdx);

    // Zebra direita
    kerbIndices.push(kIdx + 2, kIdx + 3, nextKIdx + 2);
    kerbIndices.push(kIdx + 3, nextKIdx + 3, nextKIdx + 2);
  }

  // 1. Mesh de Asfalto
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.85,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2. Mesh das Zebras
  const kerbGeo = new THREE.BufferGeometry();
  kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbPositions, 3));
  kerbGeo.setAttribute('color', new THREE.Float32BufferAttribute(kerbColors, 3));
  kerbGeo.setIndex(kerbIndices);
  kerbGeo.computeVertexNormals();

  const kerbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const kerbMesh = new THREE.Mesh(kerbGeo, kerbMat);
  kerbMesh.receiveShadow = true;
  group.add(kerbMesh);

  // 3. Faixa Tracejada Central
  const stripeGeo = createCenterStripes(points, 0.4);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
  group.add(stripeMesh);

  // 4. Grid de Largada / Linha de Chegada
  createStartFinishLine(group, points[0]);
  createStartFinishArch(group, points[0]);
  createTracksideProps(group, track);

  return group;
}

function createCenterStripes(points: TrackPoint[], stripeWidth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const count = points.length;

  for (let i = 0; i < count; i++) {
    const nextI = (i + 1) % count;
    const pt1 = points[i];
    const pt2 = points[nextI];

    // Desenha traço a cada 6 metros (3m com faixa, 3m sem)
    const isStripe = Math.floor(pt1.distance / 5) % 2 === 0;
    if (isStripe) {
      const vIdx = positions.length / 3;

      const p1LX = pt1.x + pt1.normalX * (stripeWidth / 2);
      const p1LZ = pt1.y + pt1.normalY * (stripeWidth / 2);
      const p1RX = pt1.x - pt1.normalX * (stripeWidth / 2);
      const p1RZ = pt1.y - pt1.normalY * (stripeWidth / 2);

      const p2LX = pt2.x + pt2.normalX * (stripeWidth / 2);
      const p2LZ = pt2.y + pt2.normalY * (stripeWidth / 2);
      const p2RX = pt2.x - pt2.normalX * (stripeWidth / 2);
      const p2RZ = pt2.y - pt2.normalY * (stripeWidth / 2);

      positions.push(p1LX, 0.06, p1LZ);
      positions.push(p1RX, 0.06, p1RZ);
      positions.push(p2LX, 0.06, p2LZ);
      positions.push(p2RX, 0.06, p2RZ);

      indices.push(vIdx, vIdx + 1, vIdx + 2);
      indices.push(vIdx + 1, vIdx + 3, vIdx + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createStartFinishLine(parent: THREE.Group, startPoint: TrackPoint): void {
  const lineGroup = new THREE.Group();
  const halfW = startPoint.width / 2;
  const numChecks = 16;
  const checkW = (halfW * 2) / numChecks;
  const depth = 2.0;

  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  for (let i = 0; i < numChecks; i++) {
    const isWhite = i % 2 === 0;
    const boxGeo = new THREE.PlaneGeometry(checkW, depth);
    const mesh = new THREE.Mesh(boxGeo, isWhite ? whiteMat : blackMat);

    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -startPoint.angle + Math.PI / 2;

    const offset = -halfW + i * checkW + checkW / 2;
    mesh.position.set(
      startPoint.x + startPoint.normalX * offset,
      0.065,
      startPoint.y + startPoint.normalY * offset
    );
    lineGroup.add(mesh);
  }

  parent.add(lineGroup);
}

function createStartFinishArch(parent: THREE.Group, startPoint: TrackPoint): void {
  const archGroup = new THREE.Group();
  const halfW = startPoint.width / 2 + 4.0; // Posicionado com folga fora das zebras

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222f3e, metalness: 0.7, roughness: 0.3 });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xf1c40f,
    emissive: 0xd35400,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });

  const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 8), pillarMat);
  leftPillar.position.set(
    startPoint.x + startPoint.normalX * halfW,
    5.0,
    startPoint.y + startPoint.normalY * halfW
  );

  const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 8), pillarMat);
  rightPillar.position.set(
    startPoint.x - startPoint.normalX * halfW,
    5.0,
    startPoint.y - startPoint.normalY * halfW
  );

  const beamGeo = new THREE.BoxGeometry(startPoint.width + 9, 2.2, 1.2);
  const beam = new THREE.Mesh(beamGeo, bannerMat);
  beam.position.set(startPoint.x, 9.2, startPoint.y);
  beam.rotation.y = -startPoint.angle + Math.PI / 2;

  archGroup.add(leftPillar, rightPillar, beam);
  parent.add(archGroup);
}

function createTracksideProps(parent: THREE.Group, track: Track): void {
  const points = track.points;
  const count = points.length;

  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const palmLeavesMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.6, flatShading: true });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.7 });

  const neonMat1 = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00d2ff, emissiveIntensity: 0.9 });
  const neonMat2 = new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0xff007f, emissiveIntensity: 0.9 });

  // Espalha adereços com segurança fora da pista
  for (let i = 0; i < count; i += 10) {
    const pt = points[i];
    const halfW = pt.width / 2 + 7.0;

    const leftX = pt.x + pt.normalX * (halfW + (i % 6));
    const leftZ = pt.y + pt.normalY * (halfW + (i % 6));

    const rightX = pt.x - pt.normalX * (halfW + ((i + 3) % 6));
    const rightZ = pt.y - pt.normalY * (halfW + ((i + 3) % 6));

    if (i % 20 === 0) {
      const palm = createPalmTree(palmTrunkMat, palmLeavesMat);
      palm.position.set(leftX, 0, leftZ);
      parent.add(palm);
    } else if (i % 14 === 0) {
      const cactus = createCactus(cactusMat);
      cactus.position.set(rightX, 0, rightZ);
      parent.add(cactus);
    }

    if (i === 30 || i === 80 || i === 130) {
      const billboardGeo = new THREE.BoxGeometry(14, 5, 0.8);
      const mat = i % 2 === 0 ? neonMat1 : neonMat2;
      const billboard = new THREE.Mesh(billboardGeo, mat);
      billboard.position.set(leftX + pt.normalX * 6, 4.0, leftZ + pt.normalY * 6);
      billboard.rotation.y = -pt.angle;
      parent.add(billboard);
    }
  }
}

function createPalmTree(trunkMat: THREE.Material, leavesMat: THREE.Material): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6.5, 6), trunkMat);
  trunk.position.y = 3.25;

  const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.0, 5), leavesMat);
  leaves.position.y = 6.8;

  tree.add(trunk, leaves);
  return tree;
}

function createCactus(mat: THREE.Material): THREE.Group {
  const cactus = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.5, 6), mat);
  trunk.position.y = 1.75;

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 5), mat);
  armL.position.set(-0.55, 2.2, 0);
  armL.rotation.z = Math.PI / 4;

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 5), mat);
  armR.position.set(0.55, 1.8, 0);
  armR.rotation.z = -Math.PI / 4;

  cactus.add(trunk, armL, armR);
  return cactus;
}
