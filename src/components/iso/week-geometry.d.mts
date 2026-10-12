import type { Pose } from './week-model.mjs';
export interface Paths { fill: string; shades: string[]; top: string; crease: string; bevel?: string; outline: string }
export interface Part {
  opacity?: number; charge?: number; ink?: string;
  id: string; paths: Paths; extra: string; tone: string; lit?: boolean; clip?: string;
  center: [number, number, number]; svg: string;
}
export const WIDTH: number, HEIGHT: number, HALO: string;
export const P: { origin: [number,number]; scale: number; azimuth: number; elevation: number };
export const STATIC: Part[];
export function movingParts(p?: Pose): Part[];

export function depthOf(part: Part): number;
