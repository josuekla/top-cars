import { describe, expect, it } from 'vitest';
import {
  ALL_TRACKS,
  buildTrack,
  DEFAULT_TRACK_DEFINITION,
  getTrackDefinition,
  projectPositionOnTrack,
  sampleTrackAtDistance,
  TRACK_DESERT_SANDS,
  TRACK_LAS_VEGAS,
  TRACK_MONACO_GRAND,
  TRACK_TOKYO_NIGHT,
} from './index';

describe('Track System', () => {
  it('contém todas as 4 pistas oficiais registradas em ALL_TRACKS com IDs únicos', () => {
    expect(ALL_TRACKS.length).toBe(4);
    const ids = ALL_TRACKS.map((t) => t.id);
    expect(ids).toContain('las_vegas');
    expect(ids).toContain('tokyo_night');
    expect(ids).toContain('desert_sands');
    expect(ids).toContain('monaco_grand');
    expect(new Set(ids).size).toBe(4);
  });

  it('permite buscar definições de pista via getTrackDefinition com fallback seguro', () => {
    expect(getTrackDefinition('las_vegas')).toBe(TRACK_LAS_VEGAS);
    expect(getTrackDefinition('tokyo_night')).toBe(TRACK_TOKYO_NIGHT);
    expect(getTrackDefinition('desert_sands')).toBe(TRACK_DESERT_SANDS);
    expect(getTrackDefinition('monaco_grand')).toBe(TRACK_MONACO_GRAND);
    // Compatibilidade com ID legado
    expect(getTrackDefinition('circuit-las-vegas')).toBe(TRACK_LAS_VEGAS);
    // ID inexistente cai no fallback padrão
    expect(getTrackDefinition('unknown_track_id')).toBe(DEFAULT_TRACK_DEFINITION);
  });

  it('possui propriedades ricas e completas em todas as pistas oficiais', () => {
    for (const trackDef of ALL_TRACKS) {
      expect(trackDef.name.length).toBeGreaterThan(3);
      expect(trackDef.country.length).toBeGreaterThan(2);
      expect(trackDef.flag.length).toBeGreaterThan(0);
      expect(trackDef.difficulty).toBeDefined();
      expect(trackDef.musicUrl).toBeDefined();
      expect(trackDef.musicUrl.length).toBeGreaterThan(4);
      expect(trackDef.defaultWidth).toBeGreaterThan(10);
      expect(trackDef.segments.length).toBeGreaterThan(4);

      // Validação de tema visual
      expect(trackDef.theme).toBeDefined();
      expect(typeof trackDef.theme.skyColor).toBe('number');
      expect(typeof trackDef.theme.groundColor).toBe('number');
      expect(typeof trackDef.theme.accentColor).toBe('string');
      expect(trackDef.theme.description).toBeDefined();

      // Validação de Pit Lane
      expect(trackDef.pitLane).toBeDefined();
      if (trackDef.pitLane) {
        expect(trackDef.pitLane.startDistance).toBeGreaterThan(0);
        expect(trackDef.pitLane.endDistance).toBeGreaterThan(trackDef.pitLane.startDistance);
        expect(trackDef.pitLane.width).toBeGreaterThan(4);
      }
    }
  });

  describe('Validação de Geometria e Fechamento Matemático dos Circuitos', () => {
    const tracksToTest = [
      { name: 'Las Vegas', def: TRACK_LAS_VEGAS },
      { name: 'Tokyo Night', def: TRACK_TOKYO_NIGHT },
      { name: 'Desert Sands', def: TRACK_DESERT_SANDS },
      { name: 'Monaco Grand Prix', def: TRACK_MONACO_GRAND },
    ];

    tracksToTest.forEach(({ name, def }) => {
      it(`constrói ${name} (${def.id}) em loop fechado perfeito com distância início-fim próxima de zero`, () => {
        const track = buildTrack(def);

        expect(track.points.length).toBeGreaterThan(100);
        expect(track.totalLength).toBeGreaterThan(700);

        const firstPt = track.points[0];
        const lastPt = track.points[track.points.length - 1];

        // O último ponto deve estar muito próximo do ponto inicial (loop fechado contínuo)
        const distToStart = Math.hypot(lastPt.x - firstPt.x, lastPt.y - firstPt.y);
        expect(distToStart).toBeLessThan(3.0);

        // O ponto inicial deve estar em (0, 0)
        expect(firstPt.x).toBeCloseTo(0, 1);
        expect(firstPt.y).toBeCloseTo(0, 1);
      });

      it(`amostra distâncias e tangentes com precisão ao longo de ${name}`, () => {
        const track = buildTrack(def);
        const pStart = sampleTrackAtDistance(track, 0);
        const pMid = sampleTrackAtDistance(track, track.totalLength * 0.5);

        expect(pStart.distance).toBe(0);
        expect(pMid.distance).toBeCloseTo(track.totalLength * 0.5, 1);

        // Tangentes devem ser vetores unitários
        const tanLenStart = Math.hypot(pStart.tangentX, pStart.tangentY);
        const tanLenMid = Math.hypot(pMid.tangentX, pMid.tangentY);
        expect(tanLenStart).toBeCloseTo(1.0, 2);
        expect(tanLenMid).toBeCloseTo(1.0, 2);
      });

      it(`detecta corretamente área de pista e pit lane em ${name}`, () => {
        const track = buildTrack(def);
        const midPt = track.points[Math.floor(track.points.length / 2)];

        const onTrack = projectPositionOnTrack(track, midPt.x, midPt.y);
        expect(onTrack.isOffTrack).toBe(false);
        expect(onTrack.lateralOffset).toBeLessThan(1.0);

        if (def.pitLane) {
          const midPitDist = (def.pitLane.startDistance + def.pitLane.endDistance) / 2;
          const pitSample = sampleTrackAtDistance(track, midPitDist);
          const sideSign = def.pitLane.side === 'left' ? 1 : -1;
          const pitOffset = (pitSample.width / 2 + def.pitLane.width / 2) * sideSign;
          const pitX = pitSample.x + pitSample.normalX * pitOffset;
          const pitY = pitSample.y + pitSample.normalY * pitOffset;

          const proj = projectPositionOnTrack(track, pitX, pitY);
          expect(proj.isOnPitLane).toBe(true);
          expect(proj.isOffTrack).toBe(false);
        }
      });
    });
  });
});
