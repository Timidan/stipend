import * as A from './audit.mjs';
import * as G from './lathe.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { P, auditScene, WIDTH, HEIGHT, HALO, STATIC, movingParts } from './week-geometry.mjs';
import { poseAt, CYCLE, PHASES, DROP_AT, LAND_AT, ROLL_AT, TRADE_AT, CLOSE_AT, LIFT_AT, BANK_AT, BANK_END } from './week-model.mjs';
import assert from 'node:assert/strict';

const OUT = process.argv[2] ?? 'dist/iso-poses';
mkdirSync(OUT,{recursive:true});
const V=G.viewOf(P);
// One continuous token across pocket, gravity, rolling, roller, lift and banking handoffs.
for(const t of [DROP_AT,LAND_AT,ROLL_AT,TRADE_AT,CLOSE_AT,LIFT_AT,BANK_AT,BANK_END]) {
  const before=poseAt(t-1e-6).coin, after=poseAt(t+1e-6).coin;
  assert(G.len3(G.sub3(before,after))<.005,`token jumps at ${t}`);
  assert(Math.abs(poseAt(t-1e-6).spin-poseAt(t+1e-6).spin)<.005,`token spin jumps at ${t}`);
}
assert.equal(poseAt(CYCLE).lift,0);
assert.equal(poseAt(CYCLE).insert,0);
assert.equal(poseAt(CYCLE).turn,0);
// The audit and keyboard seek both traverse this same continuous clock, including backwards.
let motionSamples=0;
for(let n=0;n<=CYCLE*240;n++) {
  const p=poseAt(n/240);
  assert(p.turn<1e-8||p.insert>.999,'key turns outside the keyway');
  assert(p.armed.length===4&&p.armed.every(x=>x>=0&&x<=1));
  assert(p.feeOpacity>=0&&p.feeOpacity<=1);
  assert(p.coin.every(Number.isFinite));
  if(n){const q=poseAt((n-1)/240);assert(G.len3(G.sub3(p.coin,q.coin))<2,'slice discontinuity');}
  motionSamples++;
}
assert.equal(poseAt(CYCLE).coinOpacity,poseAt(0).coinOpacity);
assert.equal(poseAt(CYCLE).feeOpacity,poseAt(0).feeOpacity);
assert.deepEqual(poseAt(CYCLE).armed,poseAt(0).armed);
assert.equal(poseAt(5.8).armed.filter(x=>x===1).length,4);
console.log(`motion self-check: ${motionSamples} samples, 8 continuous handoffs, reset and arming passed`);
const single=process.argv.find(a=>a.startsWith('--time='));
// Every phase, moving interval and handoff; the dense model check above covers between poses.
const times=single?[Number(single.split('=')[1])]:[...new Set([
  0,.75,1.25,1.5,1.85,2.1,2.35,2.6,3,3.3,3.85,4.4,4.95,5.3,6,6.1,6.4,6.65,6.9,7.1,7.35,7.6,7.95,
  DROP_AT,8.4,8.65,LAND_AT,LAND_AT+.15,LAND_AT+.35,LAND_AT+.6,LAND_AT+.8,9.5,9.8,10,10.4,10.8,11.2,
  TRADE_AT,12.3,12.8,13.3,14,14.5,15,15.8,16.4,16.8,17.2,17.65,18,18.6,19.1,19.6,20.1,20.6,
  BANK_END,21.5,21.9,22.2,22.55,22.8,23.1,23.2,23.6,24,
].map(t=>Number(t.toFixed(4))))].sort((a,b)=>a-b);
const base=[...STATIC,...movingParts(poseAt(0))];
const ids=base.map(p=>p.id);
const initial=base.map(p=>G.dot3(p.center,V));
const canonical=base.map((p,i)=>({name:p.id,key:initial[i],move:V,piece:p.id,ride:p.id}));
const scenes=[],pairs=[],states=[];
for(const t of times) {
  const scene=auditScene(A,poseAt(t));
  const parts=[...STATIC,...movingParts(poseAt(t))];
  const depths=Object.fromEntries(parts.map(p=>[p.id,G.dot3(p.center,V)]));
  const state={label:`t=${t}`,shares:Object.fromEntries(parts.map(p=>[p.id,depths[p.id]-initial[ids.indexOf(p.id)]]))};
  A.settle(scene,P);
  states.push(state);
  for(const pair of scene.settled.overlaps.pairs) pairs.push({...pair,a:ids.indexOf(scene.items[pair.a].name),b:ids.indexOf(scene.items[pair.b].name),state});
  scenes.push({t,scene,depths});
  console.log(`measured pose ${t}`);
}
const overlaps={pairs,states,least:.25,step:.25,V};
const solved=A.orderKeys(canonical,overlaps);
console.log(`combined order: ${solved.rules} rules, ${solved.cycles.length} interlocks, ${solved.dropped.length} dropped rules`);
const bias=single?JSON.parse(readFileSync(new URL('./week-order.json',import.meta.url),'utf8')).bias:Object.fromEntries(ids.map((id,i)=>[id,solved.keys[i]-initial[i]]));
const css=readFileSync(new URL('./week.css',import.meta.url),'utf8');
let failures=0;
for(const {t,scene,depths} of scenes) {
  // Verify the actual runtime order, not a separately idealized screenshot order.
  scene.items.forEach(i=>{i.key=depths[i.name]+bias[i.name];});
  if(process.argv.includes('--audit')) {console.log(`\nPOSE ${t}`);const result=A.auditOrExit(scene,P);failures+=A.failures(result);}
  const sorted=[...scene.items].sort((a,b)=>a.key-b.key);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="aw aw-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img"><style>${css}</style><path class="iso-halo" d="${HALO}"/>${sorted.map(i=>`<g data-part="${i.name}">${i.svg}</g>`).join('')}</svg>`;
  writeFileSync(`${OUT}/pose-${t}.svg`,svg);
  writeFileSync(`${OUT}/pose-${t}.html`,`<html><meta charset="utf-8"><style>body{margin:0;background:white}.aw{width:440px}</style><div class="aw">${svg}</div></html>`);
}
if(!failures&&!solved.dropped.length&&!solved.cycles.length){
  if(!single)writeFileSync(new URL('./week-order.json',import.meta.url),JSON.stringify({bias}));
  console.log(`all ${scenes.length} poses passed; ${failures} failures; ${pairs.length} measured overlaps; ${solved.rules} order rules; ${solved.cycles.length} interlocks; ${solved.dropped.length} dropped rules; runtime depth offsets written`);
}else{process.exitCode=1;console.log(`NOT WRITTEN: ${failures} audit failures`);}
