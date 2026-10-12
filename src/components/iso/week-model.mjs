// An illustrated signing-to-banking cycle, not a protocol clock or a simulated balance.
export const CYCLE = 24;
export const PHASES = [
  { start: 0, end: 3, name: 'Unlock' },
  { start: 3, end: 6, name: 'Sign four weeks' },
  { start: 6, end: 8, name: 'The week opens' },
  { start: 8, end: 10, name: 'Collect' },
  { start: 10, end: 12, name: 'Roll to Perpl' },
  { start: 12, end: 16.8, name: 'Trade' },
  { start: 16.8, end: 18, name: 'Close' },
  { start: 18, end: 21.8, name: 'Bank' },
  { start: 21.8, end: 23.2, name: 'Re-lock' },
  { start: 23.2, end: 24, name: 'Next week' },
];
export const R = 5;
export const SLOPE = 1 / 3;
export const NORMAL = [1 / Math.sqrt(10), 3 / Math.sqrt(10)];
export const WHEEL = [58, 24, 35];
export const CONTACT = [58 + 20 * NORMAL[0], 24, 35 + 20 * NORMAL[1]];
export const START_X = -55;
export const START_Z = CONTACT[2] + (CONTACT[0] - START_X) * SLOPE;
export const STAR = [START_X + R * NORMAL[0], 24, 125];
export const ROLL_LENGTH = (CONTACT[0] - START_X) / NORMAL[1];
export const DROP_AT = 8.15;
const GRAVITY = 90;
export const DROP_TIME = Math.sqrt(2 * (108 - START_Z - R * NORMAL[1]) / GRAVITY);
export const LAND_AT = DROP_AT + DROP_TIME;
export const ROLL_AT = 10;
export const ROLL_TIME = 1.65;
export const ACCEL = 2 * ROLL_LENGTH / ROLL_TIME ** 2;
export const TRADE_AT = ROLL_AT + ROLL_TIME;
export const CLOSE_AT = 16.8;
export const LIFT_AT = 18;
export const BANK_AT = 19.6;
const RETURN_LENGTH = Math.hypot(115, 23);
export const BANK_END = 21.1;
export const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const spring = t => t <= 0 ? 0 : 1 - (1 + 9 * t) * Math.exp(-9 * t);
export function poseAt(seconds) {
  const t = Math.max(0, Math.min(CYCLE, seconds));
  const insert = smooth(.25, 1.25, t) * (1 - smooth(22.65, 23.1, t));
  const scan = smooth(1.3, 1.42, t) * (1 - smooth(1.55, 1.9, t));
  const turn = Math.PI / 2 * smooth(1.85, 2.6, t) * (1 - smooth(21.9, 22.55, t));
  const index = Math.min(1, spring(t - 6.25) / spring(1.1));
  const star = -Math.PI / 2 * index;
  const pallet = 6 * smooth(6.05, 6.25, t) * (1 - spring(t - 7.35));
  const gate = smooth(7.9, DROP_AT, t) * (1 - smooth(21.3, 21.7, t));
  // Surface indicators charge in order; the spent allowance darkens after collection.
  // The final fade resets this illustration, not the signed allowances themselves.
  const armed = Array.from({ length: 4 }, (_, i) => smooth(3.15 + i * .55, 3.5 + i * .55, t)
    * (i === 0 ? 1 - smooth(LAND_AT, LAND_AT + .4, t) : 1) * (1 - smooth(23.55, 24, t)));
  const theta0 = Math.atan2(NORMAL[1], NORMAL[0]);
  const work = theta0 - .55 * smooth(12.3, 13.3, t) + .4 * smooth(14, 15, t) - .35 * smooth(15.5, 16.4, t);
  const theta = work * (1 - smooth(CLOSE_AT + .1, 17.65, t));
  const lift = smooth(LIFT_AT + .15, BANK_AT, t) * (1 - smooth(21.2, 23.05, t)) * 143;
  let coin, spin = 0, coinMode = 'pocket';
  if (t < DROP_AT) coin = [STAR[0] + 17 * Math.cos(star), 24, 125 + 17 * Math.sin(star)];
  else if (t < LAND_AT) { coin = [STAR[0], 24, 108 - .5 * GRAVITY * (t - DROP_AT) ** 2]; coinMode = 'drop'; }
  else if (t < ROLL_AT) { coin = [STAR[0], 24, START_Z + R * NORMAL[1]]; coinMode = 'collect'; }
  else if (t < TRADE_AT) {
    const d = .5 * ACCEL * (t - ROLL_AT) ** 2;
    coin = [STAR[0] + d * NORMAL[1], 24, START_Z + R * NORMAL[1] - d * NORMAL[0]];
    spin = -d / R; coinMode = 'roll';
  } else if (t < LIFT_AT) {
    coin = [58 + 25 * Math.cos(theta), 24, 35 + 25 * Math.sin(theta)];
    spin = -ROLL_LENGTH / R + (theta - theta0) * 5; coinMode = t < CLOSE_AT ? 'trade' : 'close';
  } else if (t < BANK_AT) { coin = [83, 24, 35 + lift]; spin = -ROLL_LENGTH / R - theta0 * 5; coinMode = 'lift'; }
  else {
    const u = Math.min(1, (t - BANK_AT) / (BANK_END - BANK_AT));
    coin = [83 - 115 * u * u, 24, 178 - 23 * u * u]; spin = -ROLL_LENGTH / R - theta0 * 5 + u * u * RETURN_LENGTH / R; coinMode = 'bank';
  }
  const feeProgress = smooth(LAND_AT, LAND_AT + .7, t);
  const fee = [STAR[0], 25.6 + 10.4 * feeProgress, START_Z + R * NORMAL[1] - 10.2 * feeProgress ** 2];
  const feeOpacity = smooth(LAND_AT, LAND_AT + .12, t) * (1 - smooth(LAND_AT + .65, LAND_AT + .85, t));
  const coinOpacity = smooth(.1, .45, t) * (1 - smooth(BANK_END - .04, BANK_END, t));
  const phase = PHASES.findIndex(p => t < p.end);
  const current = phase < 0 ? PHASES.length - 1 : phase;
  const count = armed.filter(v => v >= .999).length;
  const readouts = [
    'Unlock · one biometric check · Mera derives savings + play keys',
    `Sign · ${count}/4 weeks armed · ERC-3009 exact-amount allowances`,
    'Week 1 · opens Monday 00:00 UTC · closes 7 days later',
    `Week 1 · ${t < LAND_AT ? 'collecting' : 'collected once'} · play key · 0.25 AUSD fee`,
    'Play AUSD → Perpl · no biometrics to collect',
    'Perpl · BTC / ETH / MON · Up or Down · only play money at risk',
    'Close · free AUSD released into the banking tray',
    'Bank · free AUSD returns to the savings key',
    'Re-lock · Agora AUSD sealed in savings',
    'Week 2 · next signed allowance waiting',
  ];
  return { t, insert, scan, turn, star, armed, gate, pallet, theta, lift, coin, spin, coinMode,
    coinVisible: coinOpacity > 0, coinOpacity, fee, feeOpacity, release: smooth(9.7, 10, t) * (1 - smooth(21.3, 21.7, t)),
    phase: current, readout: readouts[current] };
}
