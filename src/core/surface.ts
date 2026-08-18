import type { SurfaceProperties, SurfaceType } from './types';

export const SURFACE_PROPERTIES: Record<SurfaceType, SurfaceProperties> = {
  asphalt: {
    friction: 1.0,
    maxSpeedMultiplier: 1.0,
    rollingResistance: 4.0,
    grip: 1.0,
  },
  grass: {
    friction: 0.35,
    maxSpeedMultiplier: 0.35,
    rollingResistance: 35.0,
    grip: 0.4,
  },
  gravel: {
    friction: 0.6,
    maxSpeedMultiplier: 0.6,
    rollingResistance: 18.0,
    grip: 0.6,
  },
  pit: {
    friction: 1.0,
    maxSpeedMultiplier: 0.45,
    rollingResistance: 6.0,
    grip: 1.0,
  },
};

export function getSurfaceProperties(surface: SurfaceType = 'asphalt'): SurfaceProperties {
  return SURFACE_PROPERTIES[surface] ?? SURFACE_PROPERTIES.asphalt;
}
