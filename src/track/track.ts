import type { Track, TrackDefinition, TrackPoint, TrackProjection } from './types';
import { clamp, dist, lerp, projectPointOnSegment } from './trackmath';

export * from './types';

export const TRACK_LAS_VEGAS: TrackDefinition = {
  id: 'las_vegas',
  name: 'Las Vegas Sunset Speedway',
  country: 'Estados Unidos',
  flag: '🇺🇸',
  difficulty: 'Fácil',
  lengthMeters: 963,
  defaultWidth: 16,
  musicUrl: '/audio/track_lasvegas.mp3',
  theme: {
    skyColor: 0x2a1435,
    fogColor: 0x2a1435,
    groundColor: 0x8a4526,
    sunColor: 0xffa550,
    ambientColor: 0xffeedd,
    accentColor: '#f1c40f',
    description: 'Pôr do sol iluminando a strip de cassinos no deserto de Nevada',
  },
  segments: [
    { type: 'straight', length: 240 }, // Reta Principal dos Cassinos
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva 1
    { type: 'straight', length: 100 }, // Reta dos Cânions
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva da Ferradura
    { type: 'straight', length: 240 }, // Reta do Deserto (Nitro Highway)
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva 3
    { type: 'straight', length: 100 }, // Reta de Retorno
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva da Junção
  ],
  pitLane: {
    startDistance: 35,
    endDistance: 200,
    side: 'right',
    width: 6,
  },
};

export const TRACK_TOKYO_NIGHT: TrackDefinition = {
  id: 'tokyo_night',
  name: 'Tokyo Neon Highway',
  country: 'Japão',
  flag: '🇯🇵',
  difficulty: 'Médio',
  lengthMeters: 1245,
  defaultWidth: 16,
  musicUrl: '/audio/track_tokyo.mp3',
  theme: {
    skyColor: 0x0c1228,
    fogColor: 0x0c1228,
    groundColor: 0x181f33,
    sunColor: 0x66ddff,
    ambientColor: 0x88a2d0,
    accentColor: '#00ffff',
    description: 'Metrópole futurista com iluminação neon cyberpunk e viadutos sinuosos',
  },
  segments: [
    { type: 'straight', length: 295 }, // Neon Boulevard (Reta Principal)
    { type: 'turn', radius: 40, angle: 90, direction: 'right' }, // Curva 1 (Entrada de Akihabara)
    { type: 'straight', length: 60 }, // Alameda Central
    { type: 'turn', radius: 40, angle: 90, direction: 'right' }, // Curva 2 (Acesso ao Viaduto)
    { type: 'straight', length: 80 }, // Viaduto Elevado
    { type: 'turn', radius: 35, angle: 90, direction: 'left' }, // Chicane Shinjuku (Entrada)
    { type: 'straight', length: 80 }, // Descida de Shinjuku
    { type: 'turn', radius: 40, angle: 90, direction: 'right' }, // Curva da Baía
    { type: 'straight', length: 140 }, // Reta Rainbow Bridge
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva do Túnel
    { type: 'straight', length: 205 }, // Reta da Via Expressa
    { type: 'turn', radius: 45, angle: 90, direction: 'right' }, // Curva Final para a Reta
  ],
  pitLane: {
    startDistance: 40,
    endDistance: 240,
    side: 'right',
    width: 6,
  },
};

export const TRACK_DESERT_SANDS: TrackDefinition = {
  id: 'desert_sands',
  name: 'Sahara Mirage',
  country: 'Egito',
  flag: '🇪🇬',
  difficulty: 'Difícil',
  lengthMeters: 1434,
  defaultWidth: 16,
  musicUrl: '/audio/track_desert.mp3',
  theme: {
    skyColor: 0x4a2810,
    fogColor: 0x5c3318,
    groundColor: 0xc29b38,
    sunColor: 0xffd060,
    ambientColor: 0x947c60,
    accentColor: '#f39c12',
    description: 'Dunas douradas, calor abrasador e curvas de alta velocidade ao redor de oásis',
  },
  segments: [
    { type: 'straight', length: 280 }, // Reta das Pirâmides (Principal)
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Curva do Escaravelho
    { type: 'straight', length: 140 }, // Reta do Oásis
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Curva da Esfinge
    { type: 'straight', length: 140 }, // Vale dos Reis
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Curva do Nilo
    { type: 'straight', length: 280 }, // Reta das Tempestades (Back Straight)
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Curva do Mirage
    { type: 'straight', length: 140 }, // Trecho das Ruínas
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Curva dos Faraós
    { type: 'straight', length: 140 }, // Aproximação da Chegada
    { type: 'turn', radius: 50, angle: 60, direction: 'right' }, // Junção das Areias
  ],
  pitLane: {
    startDistance: 40,
    endDistance: 230,
    side: 'right',
    width: 6,
  },
};

export const TRACK_MONACO_GRAND: TrackDefinition = {
  id: 'monaco_grand',
  name: 'Riviera GP',
  country: 'Mônaco',
  flag: '🇲🇨',
  difficulty: 'Extremo',
  lengthMeters: 1533,
  defaultWidth: 15,
  musicUrl: '/audio/intro.mp3',
  theme: {
    skyColor: 0x1a3c6e,
    fogColor: 0x1a3c6e,
    groundColor: 0x2c3e50,
    sunColor: 0xe6f0ff,
    ambientColor: 0x8aa8d0,
    accentColor: '#e74c3c',
    description: 'Circuito de rua clássico da Riviera com curvas travadas, túnel e orla de iates',
  },
  segments: [
    { type: 'straight', length: 180 }, // Boulevard Albert 1er (Reta dos Boxes)
    { type: 'turn', radius: 35, angle: 90, direction: 'right' }, // Sainte Dévote
    { type: 'straight', length: 90 }, // Beau Rivage (Subida)
    { type: 'turn', radius: 40, angle: 90, direction: 'left' }, // Massenet
    { type: 'straight', length: 110 }, // Casino Square
    { type: 'turn', radius: 35, angle: 90, direction: 'right' }, // Mirabeau & Fairmont
    { type: 'straight', length: 140 }, // Túnel & Grand Hotel
    { type: 'turn', radius: 40, angle: 90, direction: 'right' }, // Tabac
    { type: 'straight', length: 355 }, // Quai dos Iates & Piscine (Reta da Marina)
    { type: 'turn', radius: 40, angle: 90, direction: 'right' }, // La Rascasse
    { type: 'straight', length: 305 }, // Anthony Noghès
    { type: 'turn', radius: 35, angle: 90, direction: 'right' }, // Curva Final para a Reta
  ],
  pitLane: {
    startDistance: 25,
    endDistance: 155,
    side: 'right',
    width: 5.5,
  },
};

export const ALL_TRACKS: TrackDefinition[] = [
  TRACK_LAS_VEGAS,
  TRACK_TOKYO_NIGHT,
  TRACK_DESERT_SANDS,
  TRACK_MONACO_GRAND,
];

export const DEFAULT_TRACK_DEFINITION: TrackDefinition = TRACK_LAS_VEGAS;

export function getTrackDefinition(trackId: string): TrackDefinition {
  const found = ALL_TRACKS.find(
    (t) => t.id === trackId || (trackId === 'circuit-las-vegas' && t.id === 'las_vegas')
  );
  return found ?? DEFAULT_TRACK_DEFINITION;
}

export function buildTrack(
  definition: TrackDefinition = DEFAULT_TRACK_DEFINITION,
  stepSize: number = 2.0
): Track {
  const rawPoints: { x: number; y: number; width: number }[] = [];

  let curX = 0;
  let curY = 0;
  let curAngle = 0; // Direção +X
  const defaultWidth = definition.defaultWidth;

  rawPoints.push({ x: 0, y: 0, width: defaultWidth });

  for (const seg of definition.segments) {
    const width = seg.width ?? defaultWidth;

    if (seg.type === 'straight') {
      const steps = Math.max(1, Math.ceil(seg.length / stepSize));
      const stepLen = seg.length / steps;
      const cosA = Math.cos(curAngle);
      const sinA = Math.sin(curAngle);

      for (let i = 0; i < steps; i++) {
        curX += cosA * stepLen;
        curY += sinA * stepLen;
        rawPoints.push({ x: curX, y: curY, width });
      }
    } else if (seg.type === 'turn') {
      const angleRad = (seg.angle * Math.PI) / 180;
      const dirSign = seg.direction === 'right' ? -1 : 1;
      const arcLength = seg.radius * angleRad;
      const steps = Math.max(2, Math.ceil(arcLength / stepSize));
      const angleStep = angleRad / steps;

      const centerAngle = curAngle + (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2);
      const centerX = curX + Math.cos(centerAngle) * seg.radius;
      const centerY = curY + Math.sin(centerAngle) * seg.radius;

      const startAngle = Math.atan2(curY - centerY, curX - centerX);

      for (let i = 1; i <= steps; i++) {
        const a = startAngle + dirSign * angleStep * i;
        curX = centerX + Math.cos(a) * seg.radius;
        curY = centerY + Math.sin(a) * seg.radius;
        curAngle += dirSign * angleStep;
        rawPoints.push({ x: curX, y: curY, width });
      }
    }
  }

  // Ajuste suave de fechamento se houver resíduo numérico
  const totalCount = rawPoints.length;
  if (totalCount > 1) {
    const lastX = rawPoints[totalCount - 1].x;
    const lastY = rawPoints[totalCount - 1].y;
    const offsetX = lastX - 0;
    const offsetY = lastY - 0;

    for (let i = 0; i < totalCount; i++) {
      const weight = i / (totalCount - 1);
      rawPoints[i].x -= offsetX * weight;
      rawPoints[i].y -= offsetY * weight;
    }
    rawPoints.pop();
  }

  const count = rawPoints.length;
  const points: TrackPoint[] = [];
  let totalDist = 0;

  for (let i = 0; i < count; i++) {
    const curr = rawPoints[i];
    const prev = rawPoints[(i - 1 + count) % count];
    const next = rawPoints[(i + 1) % count];

    if (i > 0) {
      totalDist += dist(prev.x, prev.y, curr.x, curr.y);
    }

    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
    const tangentX = tx / tLen;
    const tangentY = ty / tLen;
    const angle = Math.atan2(tangentY, tangentX);

    // Normal à esquerda da pista (+90 deg)
    const normalX = -tangentY;
    const normalY = tangentX;

    points.push({
      x: curr.x,
      y: curr.y,
      angle,
      distance: totalDist,
      tangentX,
      tangentY,
      normalX,
      normalY,
      width: curr.width,
    });
  }

  const lastPoint = points[count - 1];
  const firstPoint = points[0];
  const closingDist = dist(lastPoint.x, lastPoint.y, firstPoint.x, firstPoint.y);
  const fullTrackLength = totalDist + closingDist;

  const startPt = points[0];

  return {
    definition,
    points,
    totalLength: fullTrackLength,
    startPosition: {
      x: startPt.x,
      y: startPt.y,
      angle: startPt.angle,
    },
  };
}

export function sampleTrackAtDistance(track: Track, distance: number): TrackPoint {
  const points = track.points;
  const count = points.length;
  if (count === 0) {
    return {
      x: 0,
      y: 0,
      angle: 0,
      distance: 0,
      tangentX: 1,
      tangentY: 0,
      normalX: 0,
      normalY: 1,
      width: 16,
    };
  }

  let modDist = distance % track.totalLength;
  if (modDist < 0) {
    modDist += track.totalLength;
  }

  let low = 0;
  let high = count - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].distance <= modDist) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx1 = Math.max(0, Math.min(count - 1, low - 1));
  const idx2 = (idx1 + 1) % count;

  const p1 = points[idx1];
  const p2 = points[idx2];

  let segmentDist = p2.distance - p1.distance;
  if (segmentDist <= 0) {
    segmentDist = track.totalLength - p1.distance;
  }

  const offset = modDist - p1.distance;
  const t = segmentDist > 0 ? clamp(offset / segmentDist, 0, 1) : 0;

  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
    angle: lerp(p1.angle, p2.angle, t),
    distance: modDist,
    tangentX: lerp(p1.tangentX, p2.tangentX, t),
    tangentY: lerp(p1.tangentY, p2.tangentY, t),
    normalX: lerp(p1.normalX, p2.normalX, t),
    normalY: lerp(p1.normalY, p2.normalY, t),
    width: lerp(p1.width, p2.width, t),
  };
}

export function projectPositionOnTrack(track: Track, px: number, py: number): TrackProjection {
  const points = track.points;
  const count = points.length;

  let bestDistSq = Infinity;
  let bestX = 0;
  let bestY = 0;
  let bestDistance = 0;
  let bestPoint: TrackPoint = points[0];

  for (let i = 0; i < count; i++) {
    const pA = points[i];
    const pB = points[(i + 1) % count];

    const proj = projectPointOnSegment(px, py, pA.x, pA.y, pB.x, pB.y);
    if (proj.distSq < bestDistSq) {
      bestDistSq = proj.distSq;
      bestX = proj.x;
      bestY = proj.y;
      bestPoint = pA;

      let segLen = pB.distance - pA.distance;
      if (segLen <= 0) {
        segLen = track.totalLength - pA.distance;
      }
      bestDistance = (pA.distance + proj.t * segLen) % track.totalLength;
    }
  }

  const lateralDist = Math.sqrt(bestDistSq);
  const halfWidth = bestPoint.width / 2;

  const isOffTrack = lateralDist > halfWidth;

  let isOnPitLane = false;
  const pit = track.definition.pitLane;
  if (pit) {
    if (bestDistance >= pit.startDistance && bestDistance <= pit.endDistance) {
      if (lateralDist > halfWidth && lateralDist <= halfWidth + pit.width) {
        isOnPitLane = true;
      }
    }
  }

  const progress = bestDistance / track.totalLength;

  return {
    distance: bestDistance,
    progress,
    lateralOffset: lateralDist,
    isOffTrack: isOffTrack && !isOnPitLane,
    isOnPitLane,
    closestPoint: {
      ...bestPoint,
      x: bestX,
      y: bestY,
      distance: bestDistance,
    },
  };
}
