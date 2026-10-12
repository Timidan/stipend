import * as k from './iso-kit.mjs';
import * as G from './lathe.mjs';
import { poseAt, STAR, START_Z, START_X, CONTACT, NORMAL, WHEEL } from './week-model.mjs';
export const WIDTH = 440, HEIGHT = 480;
const BASE = { x: -104, y: -49, w: 214, d: 99, r: 7 };
export const P = k.fitProjection([...k.boxCorners(BASE, -13, 0), [-95,-30,193], [105,35,193]], WIDTH, HEIGHT, { pad: 24, azimuth: 68, elevation: 22 });
const at = p => k.iso(p, P);
const V = G.viewOf(P);
const signed = (poly) => poly.reduce((a, [x, y], i) => {
  const [x2, y2] = poly[(i + 1) % poly.length];
  return a + x * y2 - x2 * y;
}, 0);
const screenOriented = (pts) => (signed(pts) < 0 ? [...pts].reverse() : pts);
function runsOf(flags, want) {
  const count = flags.length;
  const runs = [];
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  let run = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index] === want) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

function prismPaths(F, poly, s0, s1) {
  const ring = signed(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length;
  const W3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
  const capNear = G.dot3(F.a, V) > 0;
  const [nearS, farS] = capNear ? [s1, s0] : [s0, s1];
  const near = ring.map((p) => at(W3(nearS, p)));
  const far = ring.map((p) => at(W3(farS, p)));
  const normals = ring.map(([x0, y0], i) => {
    const [x1, y1] = ring[(i + 1) % n];
    return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
  });
  const facing = normals.map((m) => G.dot3(m, V) > 1e-9);
  const outline = [];
  const crease = [];
  for (const run of runsOf(facing, false)) outline.push(k.pathOf(run.map((i) => near[i])));
  for (const run of runsOf(facing, true)) {
    crease.push(k.pathOf(run.map((i) => near[i])));
    outline.push(k.pathOf(run.map((i) => far[i])));
  }
  for (let i = 0; i < n; i++) if (facing[(i + n - 1) % n] !== facing[i]) outline.push(k.pathOf([near[i], far[i]]));
  const parts = [k.pathOf(screenOriented(near), true), k.pathOf(screenOriented(far), true)];
  const buckets = [[], [], [], [], []];
  for (let i = 0; i < n; i++) {
    if (!facing[i]) continue;
    const quad = screenOriented([near[i], near[(i + 1) % n], far[(i + 1) % n], far[i]]);
    parts.push(k.pathOf(quad, true));
    buckets[G.toneOf(normals[i], P)].push(k.pathOf(quad, true));
  }
  const capTone = G.toneOf(capNear ? F.a : G.mul3(F.a, -1), P);
  buckets[capTone].push(k.pathOf(screenOriented(near), true));
  return { fill: parts.join(""), outline: outline.join(""), crease: crease.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((b) => b.join("")) };
}


const inkAt = value => `rgb(${[100,117,126].map((n,i)=>Math.round(n+([210,248,0][i]-n)*value)).join(',')})`;
const line = (points, tone='lo', closed=false) => k.lineSvg(k.pathOf(points.map(at), closed), { tone });
const rect = (x0,z0,x1,z1) => [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const frame = (o, angle=0) => G.frameOf(o,[0,1,0],[Math.cos(angle),0,Math.sin(angle)],[-Math.sin(angle),0,Math.cos(angle)]);
const matrix = (o,u,v) => { const p=at(o), a=at(G.add3(o,u)), b=at(G.add3(o,v)); return `matrix(${a[0]-p[0]} ${a[1]-p[1]} ${b[0]-p[0]} ${b[1]-p[1]} ${p[0]} ${p[1]})`; };
const MONAD='M11.782 0C8.37963 0 0 8.53443 0 11.9999C0 15.4654 8.37963 24 11.782 24C15.1844 24 23.5642 15.4653 23.5642 11.9999C23.5642 8.53458 15.1845 0 11.782 0ZM9.94598 18.8619C8.51124 18.4637 4.65378 11.5912 5.04481 10.1299C5.43584 8.66856 12.1834 4.73984 13.6181 5.1381C15.0529 5.5363 18.9104 12.4087 18.5194 13.87C18.1283 15.3314 11.3807 19.2602 9.94598 18.8619Z';
const AGORA='M107.9 0v88.1c0 3.7-4.4 5.5-7 2.9L59.4 50.5 76.8 5.3C78 2.1 81.1 0 84.5 0zM107.9 120v49.5c0 3.3-3.9 4.9-6.3 2.7l-64.3-60.6 18.9-49 46.9 45.9c3.1 3 4.8 7.1 4.8 11.5M107.9 199.8V222H8.2c-5.7 0-9.7-5.8-7.6-11.1l33.4-87 69.3 65.4c3 2.7 4.6 6.5 4.6 10.5M118.6 0v88.1c0 3.7 4.4 5.5 7 2.9L167 50.5 149.7 5.3C148.4 2.1 145.4 0 142 0zM118.6 120v49.5c0 3.3 3.9 4.9 6.3 2.7l64.3-60.6-18.9-49-46.9 45.9c-3.1 3-4.9 7.1-4.9 11.5zM118.6 199.8V222h99.6c5.8 0 9.8-5.8 7.7-11.1l-33.5-87-69.3 65.4c-2.9 2.7-4.5 6.5-4.5 10.5';
const PERPL='M9.71373 0H4V31H9.71373V0ZM21.5062 15.4392H15.7925V31H21.5062V15.4392ZM27.2196 0H21.5059V15.4392H27.2196V0Z';
const emblem=(d,size,o,u=[1,0,0],v=[0,0,-1],original=24)=>`<g transform="${matrix(o,G.mul3(u,size/original),G.mul3(v,size/original))}"><path class="aw-engraving" d="${d}"/></g>`;
function builder() {
  const items=[];
  function put(id, paths, shape, center, extra='', tone='mid', lit=false) {
    items.push({ id, paths, shape, center, extra, tone, lit, svg:k.solidSvg(paths,{tone,lit,inner:extra}) });
  }
  function slab(id,x,y,w,d,z,h,r=.5,extra='',tone='mid') {
    const plan={x,y,w,d,r}; put(id,k.slabOf(plan,z,h,P,6,.5),['slab',[plan,z,h]], [x+w/2,y+d/2,z+h/2],extra,tone);
  }
  function disc(id,F,s0,s1,r,extra='',tone='mid',lit=false) { put(id,G.disc(s0,s1,r,F,P,{steps:64,bevel:.3}),['disc',[F,s0,s1,r]],G.add3(F.o,G.mul3(F.a,(s0+s1)/2)),extra,tone,lit); }
  function ring(id,F,s0,s1,ri,ro,extra='',tone='mid') { put(id,G.ringBand(s0,s1,ri,ro,F,P,{steps:64}),['ring',[F,s0,s1,ri,ro]],G.add3(F.o,G.mul3(F.a,(s0+s1)/2)),extra,tone); }
  function prism(id,F,poly,s0,s1,extra='',tone='mid') { put(id,prismPaths(F,poly,s0,s1),['prism',[F,poly,s0,s1]],G.add3(G.add3(F.o,G.mul3(F.a,(s0+s1)/2)),G.add3(G.mul3(F.u,poly.reduce((v,p)=>v+p[0],0)/poly.length),G.mul3(F.v,poly.reduce((v,p)=>v+p[1],0)/poly.length))),extra,tone); }
  function screw(id,x,y,z,axis=[0,0,1]) { const F=G.frameAlong([x,y,z],axis); disc(id,F,0,.7,1.5,k.lineSvg(G.circleOf(F,.7,.85,P),{tone:'lo'})+line([G.pointOf(F,.71,.9,0),G.pointOf(F,.71,.9,Math.PI)])); }
  return {items,put,slab,disc,ring,prism,screw};
}
export function staticParts() {
  const b=builder(); const {slab,disc,ring,prism,screw}=b;
  for(const [i,[x,y]] of k.corners(BASE,15).entries()) { disc(`stand.foot${i}`,G.frameAlong([x,y,-13],[0,0,1]),0,2,6,'','lo'); disc(`stand.pad${i}`,G.frameAlong([x,y,-11],[0,0,1]),0,4,4.8,'','lo'); }
  slab('stand.base',BASE.x,BASE.y,BASE.w,BASE.d,-7,7,7,k.lineSvg(k.planOutline(k.insetPlan(BASE,4),0,P),{tone:'faint'}),'lo');
  for(const [i,[x,y]] of k.corners(BASE,8).entries()) screw(`stand.screw${i}`,x,y,0);
  slab('stand.label',-87,35,43,9,0,.8,1,emblem(MONAD,6,[-82,36, .81],[1,0,0],[0,1,0])+k.faceTextSvg(k.topMatrix([-72,41],.81,P),'MONAD',{size:3,tone:'mid'}),'lo');
  slab('stand.rule',-32,44,124,4,0,.6,.5,(()=>{const t=k.topTicks(-29,89,4,5,44,.61,[1.8,3.5],P);return k.lineSvg(t.minor,{tone:'faint'})+k.lineSvg(t.major,{tone:'lo'});})(),'lo');
  // Vault legs are seated on the plate; the front wall is kept behind the working face.
  for(const [i,x] of [-89,-38].entries()) {slab(`vault.foot${i}`,x-5,-29,16,31,0,4,2); slab(`vault.leg${i}`,x,-24,6,21,4,30,1); screw(`vault.mount${i}`,x-2,-13,4);}
  slab('vault.sill',-96,-36,74,48,34,5,3);
  slab('vault.body',-93,-33,68,42,39,118,4,k.lineSvg(k.sideSeam({x:-93,y:-33,w:68,d:42,r:4},150,P,6),{tone:'faint'}));
  slab('vault.lid',-96,-36,74,48,157,4,3,k.lineSvg(k.planOutline({x:-92,y:-32,w:66,d:40,r:2},161,P),{tone:'lo'}));
  for(const [i,[x,y]] of [[-90,-30],[-28,-30],[-90,6],[-28,6]].entries()) screw(`vault.lid-screw${i}`,x,y,161);
  // Door escutcheon and hinge knuckles, each ending at the next face.
  slab('vault.door',-88,9,58,2,45,107,1.5,emblem(AGORA,15,[-82,11.01, 76], [1,0,0],[0,0,-1],227));
  for(const z of [56,83]) { slab(`vault.hinge-mount${z}`,-93,9,5,2,z,14,.3);disc(`vault.hinge${z}`,G.frameAlong([-90.5,13.2,z],[0,0,1]),0,13,2.2);disc(`vault.pin${z}`,G.frameAlong([-90.5,13.2,z+13],[0,0,1]),0,1,2.2);}
  for(const [i,[x,z]] of [[-84,49],[-34,49]].entries()) screw(`vault.door-screw${i}`,x,11,z,[0,1,0]);
  const lock=frame([-81,11,144]);
  disc('lock.mount',lock,0,3,12,'','hi');
  for(let side=0;side<2;side++){
    const a0=Math.atan2(V[2],V[0])-Math.PI/2+side*Math.PI;
    const poly=[];for(let i=0;i<=48;i++){const a=a0+i/48*Math.PI;poly.push([10.4*Math.cos(a),10.4*Math.sin(a)]);}for(let i=48;i>=0;i--){const a=a0+i/48*Math.PI;poly.push([7.1*Math.cos(a),7.1*Math.sin(a)]);}
    prism(`lock.housing${side}`,lock,poly,3,9,'','hi');
  }
  for(let i=0;i<4;i++){const p=G.pointOf(lock,9,8.6,i*Math.PI/2+.45);screw(`lock.screw${i}`,...p,[0,1,0]);}
  const sf=frame([STAR[0],11,125]);
  disc('escapement.bearing',sf,0,5,7.5,k.lineSvg(G.circleOf(sf,5,5.3,P),{tone:'lo'}));
  disc('escapement.axle',sf,5,7,3);
  // Pallet slides in a bolted guide; a real compression spring closes it.
  slab('pallet.mount',-98,11,18,9,119,3,.3);
  slab('pallet.guide-bottom',-98,20,8,1,122,5,0);
  slab('pallet.guide-top',-98,24,8,1,122,5,0);
  slab('pallet.spring-seat',-98,21,1,3,122,5,0);
  screw('pallet.bolt',-94,24.5,127);
  slab('escapement.pallet-bracket-back',-33,11,26,6,119,3,.3);
  slab('escapement.pallet-bracket',-25,17,18,3,119,3,0);
  slab('escapement.pallet-guide-back',-21,20,13,1,122,5,0);
  slab('escapement.pallet-guide-front',-21,24,13,1,122,5,0);
  slab('escapement.spring-seat',-8,21,1,3,122,5,0);
  screw('escapement.guide-screw',-11,24.5,127);
  // A gravity chute with a high back, low front lip, and posts at both ends.
  const yf=frame([0,0,0]);
  const end=CONTACT;
  const floor=[[START_X-7,START_Z+7/3],[end[0],end[2]]];
  for(let dx=1;dx<=12;dx++)floor.push([end[0]-dx,end[2]+dx/3-Math.min(1.5,dx*dx/50)]);
  floor.push([START_X-7,START_Z+7/3-1.5]);
  prism('chute.floor',yf,floor,19.8,28.2,'','hi');
  prism('chute.back',yf,[[START_X-7,START_Z+7/3],[end[0],end[2]],[end[0],end[2]+7],[START_X-7,START_Z+7/3+7]],18.6,19.8);
  prism('chute.front',yf,[[START_X-7,START_Z+7/3],[end[0],end[2]],[end[0],end[2]+1.4],[START_X-7,START_Z+7/3+1.4]],28.2,29.4,'','lo');
  for(const [i,x] of [-59,25].entries()) {const z=START_Z-(x-START_X)/3-1.5; slab(`chute.post-foot${i}`,x-4,19,8,12,0,3,1);slab(`chute.post${i}`,x-1.5,21,3,6,3,z-3,0);screw(`chute.mount${i}`,x,30,3);}
  // Roller, axle and two bearing pedestals. The slice is captured between roller and guard.
  for(const [i,y] of [11,39].entries()){slab(`trade.foot${i}`,49,y-4,i?18:24,8,0,3,1);slab(`trade.pedestal${i}`,54,y-3,8,6,3,32,1);disc(`trade.bearing${i}`,frame([58,i?33:14,35]),0,i?3:2,5,'','hi');screw(`trade.mount${i}`,51,y,3);}
  const feed=[58+33*NORMAL[0],14,35+33*NORMAL[1]];
  slab('trade.feed-post',feed[0]-1.5,11,3,3,3,feed[2]-3,0);
  disc('trade.feed-bearing',frame(feed),0,7.5,2,'','mid');
  disc('trade.feed-roller',frame(feed),7.5,12.5,3,k.lineSvg(G.circleOf(frame(feed),12.5,1.8,P),{tone:'lo'}),'hi');
  disc('trade.feed-pin',frame(feed),12.5,13.2,1,'','mid');
  disc('trade.axle',frame([58,16,35]),0,2,3);
  disc('trade.front-axle',frame([58,30,35]),0,3,3);
  slab('trade.badge',54,42,8,.6,20,12,.3,emblem(PERPL,6,[55,42.61,29],[1,0,0],[0,0,-1],32));
  // Banking lift: two guide columns, top bridge, lead screw and sliding carriage.
  for(const [i,x] of [80,100].entries()){slab(`lift.foot${i}`,x-4,10,8,21,0,3,1);disc(`lift.guide${i}`,G.frameAlong([x,15.4,3],[0,0,1]),0,183,1.6);disc(`lift.collar${i}`,G.frameAlong([x,15.4,186],[0,0,1]),0,3,3);screw(`lift.mount${i}`,x,28,3);}
  slab('lift.bridge',76,11.4,28,8,189,4,1);
  slab('lift.motor',87,6,8,8,0,9,1,emblem(PERPL,5,[88.5,14.01,7],[1,0,0],[0,0,-1],32));
  
  // Return chute ends at a flanged vault mouth; the token is visible along the open channel.
  const rz=x=>178+(x-83)*.2-5*Math.sqrt(1.04);
  for(const [id,y0,y1,h] of [['floor',20,28,0],['back',18.8,20,6],['front',28,29.2,1.5]]){
    const z0=rz(-32),z1=rz(78.4);
    prism(`return.${id}`,yf,h?rect(-32,0,78.4,1).map(([x,v])=>[x,rz(x)+v*h]):[[-32,z0],[78.4,z1],[78.4,z1-1.3],[-32,z0-1.3]],y0,y1,'','mid');
  }
  slab('return.port-back',-35,11,10,7.8,145,12,1);
  slab('return.port-sill',-35,18.8,10,12.4,145,3,1);
  slab('return.port-cheek',-35,29.2,10,2,148,13,.4);
  // Open flanges frame the channel; they never fill the token's bore.
  for(const x of [-25,-23.5]) {
    slab(`return.flange-bottom${x}`,x,17.3,1.5,15.4,145,2,0);
    slab(`return.flange-back${x}`,x,17.3,1.5,1.5,147,14,0);
    slab(`return.flange-front${x}`,x,31.2,1.5,1.5,147,14,0);
  }
  screw('return.flange-bolt',-22,31.9,158,[1,0,0]);
  // A bracket ties the return rail into the lift's bridge without crossing its opening.
  slab('return.bracket',76,17,2.4,1.8,174,12,.3);
  for(const [name,y0,y1,top] of [['bottom',18.8,29.2,-1.3],['back',17.3,18.8,1],['front',29.2,30.7,2]]) {
    prism(`return.lift-flange-${name}`,yf,[[76.9,rz(76.9)-3.3],[78.4,rz(78.4)-3.3],[78.4,rz(78.4)+top],[76.9,rz(76.9)+top]],y0,y1);
  }
  screw('return.lift-flange-screw',77.7,30.7,172.2,[0,1,0]);
  // Fee receiver is bolted to the play chute's front lip, with an open slot.
  slab('fee.mount',STAR[0]-4,29.4,8,10,START_Z-8,1,0);
  slab('fee.back',STAR[0]-4,29.4,8,1,START_Z-7,7,0);
  slab('fee.front',STAR[0]-4,39.4,8,1,START_Z-7,7,0);
  for(const x of [STAR[0]-4,STAR[0]+3]) slab(`fee.side${x}`,x,30.4,1,9,START_Z-7,7,0);
  return b.items;
}

const movers=[
  { key:p=>JSON.stringify([p.insert,p.turn,p.scan]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  const F=frame([-81,11,144],-p.turn);
  const slot=rect(-.85,-3.3,.85,3.3);
  const face=poly=>k.pathOf(poly.map(([u,v])=>at(G.add3(G.add3(G.add3(F.o,G.mul3(F.a,9.04)),G.mul3(F.u,u)),G.mul3(F.v,v)))),true);
  disc('lock.plug',F,3,9,7,'<path class="aw-slot" d="'+face(slot)+'"/>','hi');
  // One blade, clipped at the stationary keyway face; rotating the frame rotates its true section.
  const extension=17*(1-p.insert);
  const KF=frame([-81,20+extension,144],-p.turn);
  const bladePoly=rect(-.65,-3,.65,3);
  // Intersect the single blade with the fixed keyway half-space before projection.
  const clip=G.rodOut(frame([-81,20,144]),0,34,7,P,{stroke:0}).clip;
  const visible=G.prismOf(KF,bladePoly,Math.max(-6,-extension),15,P);
  put('key.blade',visible,['prism',[KF,bladePoly,Math.max(-6,-extension),15]],KF.o,'','hi');
  const item=b.items.at(-1); item.clip=clip; item.svg=`<clipPath id="aw-blade-clip"><path d="${clip}"/></clipPath><g clip-path="url(#aw-blade-clip)">${item.svg}</g>`; item.auditPaths=visible;
  const bowF=G.frameOf(G.add3(KF.o,G.mul3(KF.a,23)),KF.u,KF.a,KF.v);
  const bow=k.roundedPlan({x:-8,y:-10,w:18,d:20,r:5},8);
  prism('key.bow',bowF,bow,-1.2,1.2,'','hi');
  // Engraving is attached to the broad face, in the same rotated plane as the bow.
  const bowItem=b.items.at(-1), side=G.dot3(bowF.a,G.viewOf(P))>0?1.21:-1.21;
  const bo=G.add3(bowF.o,G.mul3(bowF.a,side));
  const faceMatrix=matrix(bo,bowF.u,G.mul3(bowF.v,-1));
  const fp=Array.from({length:5},(_,i)=>{const r=2+i*1.2;const points=Array.from({length:49},(_,j)=>{const a=.15+j/48*5.8;return [1+r*.65*Math.cos(a),r*Math.sin(a)];});return k.fadeLineSvg(points,{tone:'lo',fade:[1.2,1.2]}).replaceAll('var(--anatomy-lo)','currentColor');}).join('');
  bowItem.extra=`<g data-face="" transform="${faceMatrix}"><g class="aw-fingerprint">${fp}</g></g>`;
  bowItem.ink=inkAt(p.scan);
  bowItem.svg=k.solidSvg(bowItem.paths,{tone:'hi',inner:bowItem.extra});
  return b.items;
  } },
  { key:p=>JSON.stringify([p.turn]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  const F=frame([-81,11,144],-p.turn);
  // Plug cam draws the latch back. The latch's exposed length ends at its guide face.
  prism('lock.cam',F,rect(-1.2,-7,1.2,-3.5),9,10.5,'','mid');
  const retract=6*Math.sin(p.turn);
  disc('lock.cam-pin',frame([-81-retract,21.5,144-6*Math.cos(p.turn)]),0,2,3,'','hi');
  slab('pallet.latch',-88-retract,21,11.6,3,124,2,0);
  slab('pallet.follower',-86-retract,21.5,2,2,126,22,0);
  const points=[];
  for(let i=0;i<=96;i++){const u=i/96,a=u*8*Math.PI;points.push([-97+(9-retract)*u,22.5+Math.cos(a),125+Math.sin(a)]);}
  const d=k.pathOf(points.map(at));
  b.items.push({id:'pallet.spring',paths:{fill:'',top:'',shades:['','','',''],crease:'',outline:d},shape:['tube',[points,.3/G.scaleOf(P)]],center:[-92,22.5,125],extra:'',tone:'mid',svg:k.lineSvg(d,{tone:'mid'})});
  return b.items;
  } },
  { key:p=>JSON.stringify([p.pallet]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  slab('escapement.pallet',STAR[0]+23+p.pallet,21,9,3,124,2,0);
  const pp=[];for(let i=0;i<=120;i++){const u=i/120,a=u*10*Math.PI;const from=STAR[0]+32+p.pallet;pp.push([from+(-8-from)*u,22.5+Math.cos(a),125+Math.sin(a)]);}
  const pd=k.pathOf(pp.map(at));
  b.items.push({id:'escapement.spring',paths:{fill:'',top:'',shades:['','','',''],crease:'',outline:pd},shape:['tube',[pp,.3/G.scaleOf(P)]],center:[-14,22.5,125],extra:'',tone:'mid',svg:k.lineSvg(pd,{tone:'mid'})});
  return b.items;
  } },
  { key:p=>JSON.stringify([p.star,p.gate,...p.armed]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  const sf=frame([STAR[0],18,125],p.star);
  // Four rounded lobes, four pockets: no decorative extra teeth.
  const star=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;const r=18+5*Math.cos(4*a);star.push([r*Math.cos(a),r*Math.sin(a)]);}
  // Kit extrude in a rotated world camera handles the concave outline without a hull across the valleys.
  prism('escapement.star',sf,star,0,3,'','hi');
  disc('escapement.hub',sf,3,4.6,5.5,k.lineSvg(G.circleOf(sf,4.6,2.7,P),{tone:'lo'}),'hi');
  for(let i=0;i<4;i++){
    const pf=frame([STAR[0],21,125],p.star+i*Math.PI/2);
    prism(`escapement.cheek${i}a`,pf,rect(11,-6,22,-5),0,5,'','mid');
    prism(`escapement.cheek${i}b`,pf,rect(11,5,22,6),0,5,'','mid');
    const lamp=G.pointOf(pf,.01,9,0);
    disc(`escapement.armed${i}`,frame(lamp),0,.3,1.4,'','hi');
    b.items.at(-1).charge=p.armed[i];
    b.items.at(-1).ink=inkAt(p.armed[i]);
    const length=i===0?5*(1-p.gate):5;
    prism(`escapement.gate${i}`,pf,rect(22,-5,23,5),0,Math.max(.001,length),'','hi');

  }
  return b.items;
  } },
  { key:p=>JSON.stringify([p.theta]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  // Roller rotates in real geometry; radial face ribs show its work under the token.
  const angle=(p.theta/Math.atan2(NORMAL[1],NORMAL[0])-1)*Math.PI/2;
  const wf=frame([58,18,35],angle);
  disc('trade.roller',wf,0,11,20,k.lineSvg(G.spokesOf(wf,11,6,18,12,P),{tone:'lo'})+k.lineSvg(G.circleOf(wf,11,18,P),{tone:'lo'}),'hi');
  disc('trade.hub',frame([58,29,35]),0,1,5.7,emblem(PERPL,6,[55,30.02,38],[1,0,0],[0,0,-1],32),'hi');
  return b.items;
  } },
  { key:p=>JSON.stringify([p.lift]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  // Sliding carrier seats against both rails; its tray touches the token's lower rim.
  slab('lift.carriage',78.4,17,24,3.6,27+p.lift,5,.3);
  slab('lift.nut',90,11,6,6,27+p.lift,5,.3);
  disc('lift.spindle-bottom',G.frameAlong([93,12,9],[0,0,1]),0,18+p.lift,1.3,'','lo');
  disc('lift.spindle-top',G.frameAlong([93,12,32+p.lift],[0,0,1]),0,157-p.lift,1.3,'','lo');
  const tz=x=>35+(x-83)*.2-5*Math.sqrt(1.04)+p.lift;
  prism('lift.tray',frame([0,0,0]),[[78.4,tz(78.4)],[89,tz(89)],[89,tz(89)-1],[78.4,tz(78.4)-1]],20.6,28.2,'','hi');
  prism('lift.tray-lip',frame([0,0,0]),[[88,tz(88)],[89,tz(89)],[89,tz(89)+4],[88,tz(88)+4]],20.6,28.2);
  return b.items;
  } },
  { key:p=>JSON.stringify([p.release]), build(p){
  const b=builder();
  b.slab('play.stop',STAR[0]+5,24+5.5*p.release,1,5.4,START_Z-1,8,0);
  return b.items;
  } },
  { key:p=>JSON.stringify([...p.fee,p.feeOpacity]), build(p){
  const b=builder();
  b.disc('fee.chip',frame(p.fee),-.5,.5,1.5,'','hi',true);
  b.items[0].opacity=p.feeOpacity;
  return b.items;
  } },
  { key:p=>JSON.stringify([...p.coin,p.spin,p.coinOpacity]), build(p){
  const b=builder(),{slab,disc,prism,put}=b;
  {
    const cf=frame(p.coin,p.spin);
    disc('slice',cf,-1.5,1.5,5,k.lineSvg(G.circleOf(cf,1.5,3.9,P),{tone:'hi'})+line([G.pointOf(cf,1.51,3,.5),G.pointOf(cf,1.51,3,.5+Math.PI)],'hi'),'hi',true);
    b.items[0].opacity=p.coinOpacity;
  }
  return b.items;
  } },
];
const cache=movers.map(()=>({key:null,parts:[]}));
export function movingParts(p=poseAt(0)) {
  return movers.flatMap((m,i)=>{const key=m.key(p);if(cache[i].key!==key)cache[i]={key,parts:m.build(p)};return cache[i].parts;});
}
export const depthOf=part=>G.dot3(part.center,V);
export const STATIC=staticParts();
export const HALO=k.haloOf(BASE,-13,8,P);
export function auditScene(A,p) {
  const R=A.recorder(P);
  for(const item of [...STATIC,...movingParts(p)]) {
    if(item.opacity===0) continue;
    const [kind,args]=item.shape;
    const meta={name:item.id};
    // The hand-held key and the token in free flight are externally supported bodies.
    if(item.id.startsWith('key.')||item.id==='slice'||item.id==='fee.chip')meta.ground=true;
    const shape=R.solid(A[kind](...args,meta));
    R.put({name:item.id,piece:'machine',at:item.center,svg:`<g style="opacity:${item.opacity??1};color:${item.ink??'inherit'}" class="${item.charge===undefined?'':'aw-charge'}">${item.svg}</g>`,shapes:[shape]});
  }
  return R;
}
