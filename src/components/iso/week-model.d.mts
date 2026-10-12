export interface Pose {
  scan: number; armed: number[]; fee: [number, number, number]; feeOpacity: number; coinOpacity: number; release: number;
  t: number; insert: number; turn: number; star: number; gate: number; pallet: number;
  theta: number; lift: number; coin: [number, number, number]; spin: number;
  coinMode: string; coinVisible: boolean; phase: number; readout: string;
}
export const CYCLE: number;
export function poseAt(seconds: number): Pose;
export function smooth(a: number, b: number, time: number): number;

export const PHASES: { start: number; end: number; name: string }[];
