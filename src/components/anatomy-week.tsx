'use client';

import { memo, useEffect, useRef } from 'react';
import { HALO, HEIGHT, depthOf, movingParts, STATIC, WIDTH, type Part } from './iso/week-geometry.mjs';
import { CYCLE, PHASES, poseAt } from './iso/week-model.mjs';
import orders from './iso/week-order.json';
import './iso/week.css';

const REST = movingParts(poseAt(0));
const BIAS: Record<string, number> = orders.bias;
const orderOf = (part: Part) => depthOf(part) + BIAS[part.id];
const ALL = [...STATIC, ...REST].sort((a, b) => orderOf(a) - orderOf(b));
const STOPS = PHASES.map(p => p.start);
const INITIAL = poseAt(0).readout;

function Solid({ part }: { part: Part }) {
  const { paths } = part;
  return (
    <g data-part={part.id} className={part.charge === undefined ? undefined : 'aw-charge'} style={{ opacity: part.opacity, color: part.ink }} clipPath={part.clip ? 'url(#aw-keyway)' : undefined}>
      <g className="iso-solid" data-lit={part.lit ? '' : undefined}>
        <path className="iso-fill" d={paths.fill} />
        {paths.shades.map((d, i) => <path key={i} className="iso-shade" data-shade={i} d={d} />)}
        <path className="iso-top" d={paths.top} />
        <path className="iso-line iso-crease" data-tone="faint" d={paths.crease} />
        <path className="iso-line iso-bevel" data-tone="lo" d={paths.bevel || ''} />
        <g data-detail="" dangerouslySetInnerHTML={{ __html: part.extra }} />
        <path className="iso-line iso-edge" data-tone={part.tone} d={paths.outline} />
      </g>
    </g>
  );
}

export const AnatomyWeek = memo(function AnatomyWeek() {
  const root = useRef<HTMLDivElement>(null);
  const layers = useRef<SVGGElement>(null);
  const readout = useRef<HTMLParagraphElement>(null);
  const announcement = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = root.current!, parent = layers.current!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = new Map(ALL.map(part => {
      const group = parent.querySelector<SVGGElement>(`[data-part="${part.id}"]`)!;
      const solid = group.firstElementChild!;
      return [part.id, {
        group,
        paths: Array.from(solid.children).filter((node): node is SVGPathElement => node.tagName === 'path'),
        details: Array.from(group.querySelectorAll<SVGPathElement>('[data-detail] path')),
        transforms: Array.from(group.querySelectorAll<SVGElement>('[data-detail] [transform]')),
        previous: part, order: orderOf(part),
      }];
    }));
    let frame = 0, last = 0, time = 0, target: number | null = null;
    let visible = false, held = false, hover = false, focused = false, pressed = false;
    let warmup = 1.4, resume = 0, phase = -1, orderKey = '';
    const touring = () => !held && !hover && !focused && !pressed && !media.matches;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; last = 0; };
    const draw = () => {
      const pose = poseAt(time);
      const parts = movingParts(pose);
      for (const part of parts) {
        const node = nodes.get(part.id)!;
        if (node.previous === part) continue;
        node.group.style.opacity = String(part.opacity ?? 1);
        node.group.style.color = part.ink ?? '';
        const p = part.paths;
        const values = [p.fill, ...p.shades, p.top, p.crease, p.bevel || '', p.outline];
        values.forEach((d, i) => { if (node.paths[i].getAttribute('d') !== d) node.paths[i].setAttribute('d', d); });
        const detailPaths = [...part.extra.matchAll(/\bd="([^"]*)"/g)];
        detailPaths.forEach((match, i) => node.details[i]?.setAttribute('d', match[1]));
        const transforms = [...part.extra.matchAll(/\btransform="([^"]*)"/g)];
        transforms.forEach((match, i) => node.transforms[i]?.setAttribute('transform', match[1]));
        node.previous = part;
        node.order = orderOf(part);
      }
      // The kit solves these depth offsets across the entire sampled motion.
      const sorted = [...nodes.values()].sort((a, b) => a.order - b.order);
      const signature = sorted.map(n => n.previous.id).join('|');
      if (signature !== orderKey) {
        const fragment = document.createDocumentFragment();
        sorted.forEach(node => fragment.appendChild(node.group));
        parent.appendChild(fragment);
        orderKey = signature;
      }
      stage.dataset.time = time.toFixed(3);
      stage.dataset.phase = String(pose.phase);
      if (readout.current) readout.current.textContent = pose.readout;
      if (phase !== pose.phase) {
        if (phase !== -1 && announcement.current) announcement.current.textContent = PHASES[pose.phase].name;
        phase = pose.phase;
      }
    };
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      if (target !== null) {
        time = media.matches ? target : time + (target - time) * (1 - Math.exp(-dt / .16));
        if (Math.abs(target - time) < .001) { time = target; target = null; }
      } else if (touring()) {
        if (warmup > 0) warmup -= dt;
        else if (resume > 0) resume -= dt;
        else time = (time + dt) % CYCLE;
      }
      draw();
      frame = visible && (target !== null || (touring())) ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
    const interact = () => { warmup = 0; resume = 3.6; };
    const seek = (next: number) => { interact(); target = next; run(); };
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') { hover = true; interact(); if (target === null) stop(); } };
    const leave = () => { hover = false; interact(); run(); };
    const down = (e: PointerEvent) => { pressed = true; interact(); stage.setPointerCapture(e.pointerId); if (target === null) stop(); };
    const up = (e: PointerEvent) => {
      pressed = false; interact();
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      run();
    };
    const focus = () => {
      focused = stage.matches(':focus-visible'); interact(); if (focused && target === null) stop();
      if (announcement.current) announcement.current.textContent = PHASES[poseAt(time).phase].name;
    };
    const blur = () => { focused = false; interact(); run(); };
    const key = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End', ' ', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault(); focused = true; interact();
        if (e.key === ' ' || e.key === 'Enter') {
          if (e.repeat) return;
          held = !held; target = null;
          if (announcement.current) announcement.current.textContent = held ? 'Tour held' : 'Tour resumes after focus and pointer leave';
          run();
        } else if (e.key === 'Escape') { held = false; target = null; stage.blur(); run(); }
        else if (e.key === 'Home') seek(0);
        else if (e.key === 'End') seek(STOPS.at(-1)!);
        else {
          const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
          const current = poseAt(time).phase;
          seek(STOPS[Math.max(0, Math.min(STOPS.length - 1, current + direction))]);
        }
      }
    };
    const changed = () => {
      target = null; stop();
      if (media.matches) time = 13.5;
      draw(); run();
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run(); else stop();
    }, { rootMargin: '120px 0px' });
    stage.addEventListener('pointerenter', enter);
    stage.addEventListener('pointerleave', leave);
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('lostpointercapture', up);
    stage.addEventListener('focusin', focus);
    stage.addEventListener('focusout', blur);
    stage.addEventListener('keydown', key);
    // The legend asks for a phase by index (`aw:seek`), the same jump the arrow keys make.
    const seekTo = (e: Event) => { const i = (e as CustomEvent<number>).detail; if (Number.isInteger(i) && STOPS[i] !== undefined) seek(STOPS[i]); };
    stage.addEventListener('aw:seek', seekTo);
    media.addEventListener('change', changed);
    observer.observe(stage);
    if (media.matches) time = 13.5;
    draw();
    return () => {
      stop(); observer.disconnect(); media.removeEventListener('change', changed);
      stage.removeEventListener('pointerenter', enter); stage.removeEventListener('pointerleave', leave);
      stage.removeEventListener('pointerdown', down); stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up); stage.removeEventListener('lostpointercapture', up);
      stage.removeEventListener('focusin', focus); stage.removeEventListener('focusout', blur); stage.removeEventListener('keydown', key); stage.removeEventListener('aw:seek', seekTo);
    };
  }, []);

  return (
    <div ref={root} className="aw mx-auto mt-4 max-w-[25rem]" tabIndex={0} role="group" aria-label="Weekly slice machine. Hover, touch or focus to hold. Space holds or resumes the tour after leaving the figure. Left and Right arrows step to the previous or next phase.">
      <svg className="aw-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby="aw-title aw-description">
        <title id="aw-title">The weekly slice machine</title>
        <desc id="aw-description">One biometric passkey derives savings and play keys via Mera and turns a vault lock. Four signed weekly allowances form a sprung escapement. One lime AUSD token drops into the play-key tray, splits a 0.25 AUSD fee into the treasury slot, rolls to the Perpl trading wheel, then returns by a guided banking lift. Savings remain in the vault. The whole machine rests on Monad.</desc>
        <defs><clipPath id="aw-keyway"><path d={REST.find(p => p.id === 'key.blade')!.clip} /></clipPath></defs>
        <path className="iso-halo" d={HALO} />
        <g ref={layers}>{ALL.map(part => <Solid key={part.id} part={part} />)}</g>
      </svg>
      <p ref={readout} className="aw-readout">{INITIAL}</p>
      <p className="aw-caption">Illustrated 24-second cycle · time compressed. Agora AUSD stays with the savings key. Each step settles on Monad in about a second.</p>
      <span ref={announcement} className="aw-sr" aria-live="polite" />
    </div>
  );
});
