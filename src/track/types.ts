export type SegmentType = 'straight' | 'turn';
export type TurnDirection = 'left' | 'right';

export interface StraightSegmentDef {
  type: 'straight';
  length: number;
  width?: number;
}

export interface TurnSegmentDef {
  type: 'turn';
  radius: number;
  angle: number; // Em graus
  direction: TurnDirection;
  width?: number;
}

export type TrackSegmentDef = StraightSegmentDef | TurnSegmentDef;

export interface PitLaneDef {
  startDistance: number;
  endDistance: number;
  side: 'left' | 'right';
  width: number;
}

export interface TrackTheme {
  skyColor: number;
  fogColor?: number;
  groundColor: number;
  sunColor?: number;
  ambientColor?: number;
  accentColor?: string;
  description?: string;
}

export type TrackId = 'las_vegas' | 'tokyo_night' | 'desert_sands' | 'monaco_grand' | string;

export interface TrackDefinition {
  id: TrackId;
  name: string;
  country: string;
  flag: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil' | 'Extremo' | string;
  lengthMeters?: number;
  defaultWidth: number;
  musicUrl: string;
  theme: TrackTheme;
  segments: TrackSegmentDef[];
  pitLane?: PitLaneDef;
}

export interface TrackPoint {
  x: number;
  y: number;
  angle: number;
  distance: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  width: number;
}

export interface Track {
  definition: TrackDefinition;
  points: TrackPoint[];
  totalLength: number;
  startPosition: { x: number; y: number; angle: number };
}

export interface TrackProjection {
  distance: number;
  progress: number;
  lateralOffset: number;
  isOffTrack: boolean;
  isOnPitLane: boolean;
  closestPoint: TrackPoint;
}
