/* =========================================================
   러닝 근력 트레이닝 — single-page workout timer
   ========================================================= */
(() => {
'use strict';

/* ---------- config ---------- */
const STORE_KEY = 'runner-strength-v1';
// The version is taken from this script's own ?v= query, so the number on screen is
// the number of the file that is actually running. A stale copy served from the iOS
// web-app cache therefore shows its own old version instead of pretending to be new.
const BUILD = (() => {
  try{
    const sc = document.currentScript || document.querySelector('script[src*="app.js"]');
    return (sc && new URL(sc.src, location.href).searchParams.get('v')) || 'dev';
  }catch(e){ return 'dev'; }
})();
const PLAN_REV = 2;     // bump when the default layout below changes
const DEFAULTS = {
  foamRoll: 120, tBalance: 40, bandMarch: 40, clamshell: 20, hipBridge: 40, wallSit: 40,
  legRaise: 20, hamstring: 40, switchTime: 5,
  restEx: 10, restSet: 30, sets: 3, prep: 10,
  bell: 5, beep: true, voice: true, vibe: true, silentBell: true, sayCount: true,
  theme: 'system',
  // the layout: foam rolling to warm up, five exercises per set, a stretch to finish
  order: ['foamRoll', '@loop', 'tBalance', 'bandMarch', 'clamshell', 'hipBridge', 'wallSit',
          'legRaise', '@cool', 'hamstring'],
  off: ['legRaise'],    // kept in the list, switched off; its time and place survive
  plan: PLAN_REV,
};
const THEMES = ['system', 'light', 'dark'];
const LIMITS = {
  foamRoll:[10,600], tBalance:[5,300], bandMarch:[5,300], clamshell:[5,300],
  hipBridge:[5,300], wallSit:[5,300], legRaise:[5,300], hamstring:[5,300],
  switchTime:[0,60],
  restEx:[0,300], restSet:[0,600], sets:[1,10], prep:[0,60], bell:[0,10],
};

let migrated = false;
let cfg = load();
if (migrated) save();   // write the new layout back, so it is not re-applied every launch

function load(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const out = { ...DEFAULTS, order: DEFAULTS.order.slice(), off: DEFAULTS.off.slice() };
    for (const k of Object.keys(DEFAULTS)){
      if (!(k in raw)) continue;
      if (k === 'order'){ if (Array.isArray(raw.order)) out.order = raw.order.filter(v => typeof v === 'string'); continue; }
      if (k === 'off'){ if (Array.isArray(raw.off)) out.off = raw.off.filter(v => typeof v === 'string'); continue; }
      if (k === 'plan') continue;
      if (typeof DEFAULTS[k] === 'boolean') out[k] = !!raw[k];
      else if (typeof DEFAULTS[k] === 'string') out[k] = String(raw[k]);
      else if (Number.isFinite(+raw[k])) out[k] = clamp(k, Math.round(+raw[k]));
    }
    if (!THEMES.includes(out.theme)) out.theme = DEFAULTS.theme;
    // A layout saved against an older default is dropped so a new arrangement actually
    // arrives; durations, sounds and the theme are personal and are always kept.
    if ((+raw.plan || 1) !== PLAN_REV){
      out.order = DEFAULTS.order.slice();
      out.off = DEFAULTS.off.slice();
      migrated = true;
    }
    out.plan = PLAN_REV;
    return out;
  }catch(e){ return { ...DEFAULTS }; }
}
function save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }catch(e){} }
function clamp(key, v){
  const l = LIMITS[key]; if (!l) return v;
  return Math.min(l[1], Math.max(l[0], v));
}

/* ---------- exercise photos ---------- */
const FIG = {
  foamRoll:  { src:'img/foam-roll.webp',      w:960, h:359, sm:'img/foam-roll-sm.webp',      smW:437, smH:425 },
  tBalance:  { src:'img/t-balance.webp',      w:960, h:480, sm:'img/t-balance-sm.webp',      smW:437, smH:425 },
  bandMarch: { src:'img/band-march.webp',     w:354, h:960, sm:'img/band-march-sm.webp',     smW:437, smH:425 },
  clamshell: { src:'img/clamshell.webp',      w:960, h:329, sm:'img/clamshell-sm.webp',      smW:437, smH:425 },
  hipBridge: { src:'img/hip-bridge.webp',     w:960, h:365, sm:'img/hip-bridge-sm.webp',     smW:437, smH:425 },
  wallSit:   { src:'img/wall-sit.webp',       w:534, h:960, sm:'img/wall-sit-sm.webp',       smW:437, smH:425 },
  legRaise:  { src:'img/side-leg-raise.webp', w:960, h:361, sm:'img/side-leg-raise-sm.webp', smW:437, smH:425 },
  hamstring: { src:'img/hamstring.webp',      w:960, h:572, sm:'img/hamstring-sm.webp',      smW:437, smH:425 },
};
// the leg-raise photo shows the left leg lifted; mirror it for the right side
function shot(key, alt, opt){
  const f = FIG[key];
  if (!f) return '';
  const o = opt || {};
  const cls = (o.small ? 'thumb' : 'shot-img') + (o.flip ? ' flip' : '');
  const src = o.small ? f.sm : f.src;
  const w = o.small ? f.smW : f.w;
  const h = o.small ? f.smH : f.h;
  return `<img class="${cls}" src="${src}" width="${w}" height="${h}" alt="${alt}" decoding="async">`;
}
const needsFlip = step => !!step.side && !!step.shotSide && step.side !== step.shotSide;
// warm the cache so switching exercises never shows an empty frame
function preloadShots(){
  Object.values(FIG).forEach(f => { [f.src, f.sm].forEach(u => { const i = new Image(); i.src = u; }); });
}

/* ---------- exercises ---------- */
const EXERCISES = [
  { id:'foamRoll',  ko:'폼롤러',              en:'Foam Rolling',  say:'폼롤러',            desc:'근막 이완·준비',   fig:'foamRoll' },
  { id:'tBalance',  ko:'T 밸런스',            en:'T Balance',     say:'티 밸런스',          desc:'균형·둔근 후면',   fig:'tBalance',  perSide:true, shotSide:'왼쪽' },
  { id:'bandMarch', ko:'래터럴 밴드 마치',     en:'Lateral Band March', say:'래터럴 밴드 마치', desc:'중둔근 활성',   fig:'bandMarch', perSide:true, shotSide:'왼쪽' },
  { id:'clamshell', ko:'클램쉘',              en:'Clamshell',     say:'클램쉘',            desc:'중둔근·고관절',    fig:'clamshell', perSide:true, shotSide:'왼쪽' },
  { id:'hipBridge', ko:'힙 브릿지',           en:'Hip Bridge',    say:'힙 브릿지',          desc:'둔근·햄스트링',    fig:'hipBridge' },
  { id:'wallSit',   ko:'월 싯',               en:'Wall Sit',      say:'월싯',              desc:'허벅지 앞·코어',   fig:'wallSit'   },
  { id:'legRaise',  ko:'사이드 레그 레이즈',   en:'Side Leg Raise', say:'사이드 레그 레이즈', desc:'중둔근 안정',     fig:'legRaise',  perSide:true, shotSide:'왼쪽' },
  { id:'hamstring', ko:'월 햄스트링 스트레치', en:'Wall Hamstring Stretch', say:'월 햄스트링 스트레치', desc:'햄스트링·종아리', fig:'hamstring', perSide:true, shotSide:'왼쪽' },
];
const byId = id => EXERCISES.find(e => e.id === id);

/* ---------- layout: warm-up · repeat · cool-down ---------- */
// cfg.order is one flat list that carries the two dividers alongside the exercises, so
// dragging stays a plain reorder and an exercise's block is just how many dividers now
// sit above it. Unknown ids are dropped, a missing divider is put back, and exercises
// added to the catalogue later join the repeat block.
const D_LOOP = '@loop', D_COOL = '@cool';
const isOff = id => Array.isArray(cfg.off) && cfg.off.indexOf(id) >= 0;

function layoutIds(){
  const seen = new Set();
  const out = [];
  (Array.isArray(cfg.order) ? cfg.order : []).forEach(id => {
    if (seen.has(id)) return;
    if (id === D_LOOP || id === D_COOL || byId(id)){ seen.add(id); out.push(id); }
  });
  if (!seen.has(D_LOOP)) out.unshift(D_LOOP);
  if (!seen.has(D_COOL)) out.push(D_COOL);
  if (out.indexOf(D_COOL) < out.indexOf(D_LOOP)){      // the two can never cross
    out.splice(out.indexOf(D_COOL), 1);
    out.push(D_COOL);
  }
  const fresh = EXERCISES.filter(e => !seen.has(e.id)).map(e => e.id);
  if (fresh.length) out.splice(out.indexOf(D_COOL), 0, ...fresh);
  return out;
}
// the three blocks, with the switched-off exercises already taken out
function zones(){
  const ids = layoutIds();
  const a = ids.indexOf(D_LOOP), b = ids.indexOf(D_COOL);
  const live = part => part.map(byId).filter(e => e && !isOff(e.id));
  return { ids,
    warmup:   live(ids.slice(0, a)),
    loop:     live(ids.slice(a + 1, b)),
    cooldown: live(ids.slice(b + 1)) };
}
function setOrder(ids){ cfg.order = ids.slice(); save(); renderHome(); }
function toggleExercise(id){
  const off = Array.isArray(cfg.off) ? cfg.off.slice() : [];
  const i = off.indexOf(id);
  if (i >= 0) off.splice(i, 1); else off.push(id);
  cfg.off = off;
  save(); renderExerciseRows(); fillSettings(); renderHome();
}

/* ---------- plan builder ---------- */
function buildPlan(c){
  const z = zones();
  const steps = [];
  // one flat run of slots — warm-up once, the repeat block once per set, cool-down
  // once. Rests then fall between neighbours, and a set rest wherever a set turns over.
  const seq = [];
  z.warmup.forEach((e, i) => seq.push({ e, set:-1, zone:'warmup', idx:i + 1, of:z.warmup.length }));
  for (let s = 0; s < c.sets; s++)
    z.loop.forEach((e, i) => seq.push({ e, set:s, zone:'loop', idx:i + 1, of:z.loop.length }));
  z.cooldown.forEach((e, i) => seq.push({ e, set:-1, zone:'cool', idx:i + 1, of:z.cooldown.length }));
  if (!seq.length) return steps;

  if (c.prep > 0) steps.push({ kind:'prep', dur:c.prep, ko:'준비하세요', set:0, zone:seq[0].zone, inst:0, idx:1, of:seq[0].of });

  seq.forEach((slot, n) => {
    const dur = c[slot.e.id];
    const meta = { set:Math.max(0, slot.set), zone:slot.zone, inst:n + 1, idx:slot.idx, of:slot.of };
    if (slot.e.perSide){
      steps.push(work(slot.e, dur, meta, '오른쪽'));
      if (c.switchTime > 0) steps.push({ kind:'switch', dur:c.switchTime, ko:'다리 바꾸기', ...meta });
      steps.push(work(slot.e, dur, meta, '왼쪽'));
    } else {
      steps.push(work(slot.e, dur, meta));
    }
    const next = seq[n + 1];
    if (!next) return;
    const turningOver = slot.zone === 'loop' && next.zone === 'loop' && next.set !== slot.set;
    if (turningOver){
      if (c.restSet > 0) steps.push({ kind:'setrest', dur:c.restSet, ko:'세트 휴식', ...meta });
    } else if (c.restEx > 0){
      steps.push({ kind:'rest', dur:c.restEx, ko:'휴식', ...meta });
    }
  });
  return steps;

  function work(e, dur, meta, side){
    return { kind:'work', id:e.id, dur, side,
             ko:e.ko, en:e.en, say:e.say, fig:e.fig, shotSide:e.shotSide, ...meta };
  }
}
// one bar per exercise slot, grouped the way the plan runs
function segmentGroups(c){
  const z = zones(), g = [];
  if (z.warmup.length) g.push(z.warmup.length);
  if (z.loop.length) for (let s = 0; s < c.sets; s++) g.push(z.loop.length);
  if (z.cooldown.length) g.push(z.cooldown.length);
  return g;
}
const totalOf = steps => steps.reduce((a, s) => a + s.dur, 0);
const mmss = s => {
  s = Math.max(0, Math.round(s));
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
};

/* ---------- audio ---------- */
const Audio_ = {
  ctx: null,
  keepAlive: null,
  sessionActive: false,
  supported: typeof navigator !== 'undefined' && !!navigator.audioSession,
  // iOS silences Web Audio when the ring/silent switch is on. Declaring a playback
  // session lifts that (iOS 16.4+) — but speech playback and backgrounding knock the
  // session back to the default, so this has to be re-asserted, not set once.
  applySession(){
    try{
      if (!navigator.audioSession) return;
      const want = cfg.silentBell ? 'playback' : 'auto';
      if (navigator.audioSession.type !== want) navigator.audioSession.type = want;
      this.sessionActive = navigator.audioSession.type === 'playback';
    }catch(e){ this.sessionActive = false; }
  },
  init(){
    this.applySession();
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // unlock on iOS with a silent blip
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    g.gain.value = 0.0001; o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.02);
  },
  resume(){ if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  // An inaudible tone held for the whole workout. It stops iOS from tearing the audio
  // session down between the sparse beeps, which is what drops the first bell after speech.
  startKeepAlive(){
    if (!this.ctx || this.keepAlive) return;
    try{
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 50; g.gain.value = 0.0002;
      o.connect(g); g.connect(this.ctx.destination); o.start();
      this.keepAlive = { o, g };
    }catch(e){}
  },
  stopKeepAlive(){
    if (!this.keepAlive) return;
    try{ this.keepAlive.o.stop(); this.keepAlive.o.disconnect(); this.keepAlive.g.disconnect(); }catch(e){}
    this.keepAlive = null;
  },
  beep(freq = 880, dur = 0.14, vol = 0.32, type = 'sine'){
    if (!cfg.beep || !this.ctx) return;
    this.applySession();
    this.resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  // countdown bell: triangle wave carries much better on a phone speaker than a sine
  tick(n){ this.beep(n <= 1 ? 1050 : 840, 0.2, 0.55, 'triangle'); },
  go(){ this.beep(1180, 0.34, 0.45); setTimeout(() => this.beep(1570, 0.4, 0.4), 130); },
  done(){ [0, 170, 340].forEach((d, i) => setTimeout(() => this.beep(880 + i*260, 0.35, 0.36), d)); },
};

const Voice = {
  ready: false,
  init(){
    if (!('speechSynthesis' in window)) return;
    // prime the engine on the first user gesture (iOS requirement)
    try{
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; speechSynthesis.speak(u);
      this.ready = true;
    }catch(e){}
  },
  pickVoice(){
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices() || [];
    return vs.find(v => v.lang && v.lang.toLowerCase().startsWith('ko')) || null;
  },
  say(text, { force = false, rate = 1.05 } = {}){
    if (!('speechSynthesis' in window)) return;
    if (!cfg.voice && !force) return;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = rate; u.pitch = 1; u.volume = 1;
      const v = this.pickVoice(); if (v) u.voice = v;
      u.onend = u.onerror = () => Audio_.applySession();
      speechSynthesis.speak(u);
      Audio_.applySession();
    }catch(e){}
  },
  stop(){ try{ speechSynthesis.cancel(); }catch(e){} },
};

function buzz(ms){ if (cfg.vibe && navigator.vibrate) { try{ navigator.vibrate(ms); }catch(e){} } }

/* ---------- wake lock ---------- */
let wakeLock = null;
async function lockScreen(){
  try{
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  }catch(e){}
}
function unlockScreen(){ try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible'){
    if (S.running && !S.paused) lockScreen();
    Audio_.applySession();
    Audio_.resume();
  }
});

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const el = {
  home: $('home'), workout: $('workout'), done: $('done'),
  planList: $('planList'), metaSets: $('metaSets'), metaTime: $('metaTime'), metaMoves: $('metaMoves'),
  btnStart: $('btnStart'), btnSettings: $('btnSettings'),
  segments: $('segments'), totalLeft: $('totalLeft'),
  cRound: $('cRound'), cRoundT: $('cRoundT'), cEx: $('cEx'), cExT: $('cExT'),
  roundLabel: $('roundLabel'), roundOf: $('roundOf'), loopNote: $('loopNote'),
  figure: $('figure'), ringFg: $('ringFg'), ringText: document.querySelector('.ring-text'),
  bigCount: $('bigCount'), phaseLabel: $('phaseLabel'),
  nextCard: $('nextCard'), nextName: $('nextName'), nextLabel: $('nextLabel'), nextFigure: $('nextFigure'),
  nowDur: $('nowDur'), nowName: $('nowName'), nowSide: $('nowSide'),
  btnPrev: $('btnPrev'), btnNext: $('btnNext'), btnClose: $('btnClose'), btnSound: $('btnSound'),
  pauseVeil: $('pauseVeil'), btnResume: $('btnResume'), btnQuit: $('btnQuit'),
  doneTime: $('doneTime'), doneSets: $('doneSets'), btnAgain: $('btnAgain'), btnHome: $('btnHome'),
  sheet: $('settings'), scrim: $('scrim'), btnSheetClose: $('btnSettingsClose'),
  btnTestSound: $('btnTestSound'), btnReset: $('btnReset'),
  themeSeg: $('themeSeg'), themeColor: $('themeColor'),
  appVer: $('appVer'), verRow: $('verRow'), updNote: $('updNote'),
  exRows: $('exRows'), sheetBody: document.querySelector('.sheet-body'),
};
const RING_LEN = 2 * Math.PI * 54;

/* ---------- state ---------- */
const S = {
  steps: [], i: 0, endAt: 0, stepDur: 0, remain: 0,
  running: false, paused: false, pauseAt: 0,
  lastBeepSec: -1, raf: 0, elapsedBefore: 0, startedAt: 0,
};

/* ---------- theme ---------- */
function applyTheme(){
  const t = THEMES.includes(cfg.theme) ? cfg.theme : 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  el.themeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
  paintThemeColor();
}
// keep the mobile status bar in step with whatever is at the top of the screen
function paintThemeColor(){
  const cs = getComputedStyle(document.documentElement);
  const phase = el.workout.classList.contains('is-active') ? el.workout.dataset.phase : '';
  let v;
  if (phase === 'rest' || phase === 'setrest' || phase === 'switch') v = cs.getPropertyValue('--top-rest');
  else if (phase) v = cs.getPropertyValue('--top-work');
  else v = cs.getPropertyValue('--bg');
  if (el.themeColor && v.trim()) el.themeColor.setAttribute('content', v.trim());
}
if (window.matchMedia){
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (cfg.theme === 'system') paintThemeColor(); };
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
}

/* ---------- home rendering ---------- */
function renderHome(){
  const steps = buildPlan(cfg);
  const z = zones();
  const card = e => {
    const per = cfg[e.id];
    return `<li>
      <div class="pic">${shot(e.fig, e.ko, { small:true })}</div>
      <div class="tx"><b>${e.ko}</b><small>${e.desc}</small></div>
      <div class="tm">${e.perSide ? `${per}초 × 좌우` : `${per}초`}</div>
    </li>`;
  };
  const block = (list, cap) => list.length
    ? `<li class="plan-cap"><span>${cap}</span></li>` + list.map(card).join('') : '';
  // the captions only earn their space once something sits outside the repeat block
  const zoned = z.warmup.length || z.cooldown.length;
  const total = z.warmup.length + z.loop.length + z.cooldown.length;
  el.planList.innerHTML =
    !total ? '<li class="plan-empty">운동이 모두 꺼져 있습니다.<br>설정에서 켜주세요.</li>'
    : zoned ? block(z.warmup, '웜업 · 1회') + block(z.loop, `반복 · ${cfg.sets}세트`) + block(z.cooldown, '마무리 · 1회')
    : z.loop.map(card).join('');
  el.metaSets.textContent = z.loop.length ? cfg.sets : '–';
  el.metaTime.textContent = mmss(totalOf(steps)).replace(/^0/, '');
  el.metaMoves.textContent = total;
  el.btnStart.disabled = !steps.some(st => st.kind === 'work');
}

/* ---------- workout rendering ---------- */
function renderSegments(){
  el.segments.innerHTML = '';
  segmentGroups(cfg).forEach(n => {
    const g = document.createElement('div');
    g.className = 'seg-group';
    g.style.flex = String(n);          // a block of six is twice the width of a block of three
    for (let i = 0; i < n; i++){
      const d = document.createElement('div');
      d.className = 'seg';
      g.appendChild(d);
    }
    el.segments.appendChild(g);
  });
}
function updateSegments(step){
  // an exercise counts as finished once we reach the rest that follows it
  const inProgress = step.kind === 'work' || step.kind === 'switch';
  const finished = inProgress ? step.inst - 1 : step.inst;
  const current = inProgress ? step.inst : 0;
  [...el.segments.querySelectorAll('.seg')].forEach((d, idx) => {
    const n = idx + 1;
    d.classList.toggle('done', n <= finished);
    d.classList.toggle('now', n === current);
  });
}

function figFor(step){
  return step.kind === 'work' ? shot(step.fig, step.ko, { flip: needsFlip(step) }) : '';
}
// Measure the laid-out page rather than asking the window: innerHeight is short by
// the status bar in an iOS standalone web app, which left a dead strip at the bottom.
function nextWorkStep(from){
  for (let k = from + 1; k < S.steps.length; k++){
    if (S.steps[k].kind === 'work') return S.steps[k];
  }
  return null;
}

function paintStep(){
  const step = S.steps[S.i];
  el.workout.dataset.phase = step.kind;
  updateSegments(step);

  // the left counter is a round number inside the repeat block and a block name outside it
  const inLoop = step.zone === 'loop';
  el.roundLabel.textContent = inLoop ? '라운드' : '구간';
  el.cRound.textContent = inLoop ? Math.min(cfg.sets, step.set + 1)
                                 : (step.zone === 'warmup' ? '웜업' : '마무리');
  el.cRound.classList.toggle('txt', !inLoop);
  el.roundOf.hidden = !inLoop;
  el.cRoundT.textContent = cfg.sets;
  el.cEx.textContent = Math.max(1, step.idx || 1);
  el.cExT.textContent = step.of || 1;

  if (step.kind === 'work'){
    el.figure.innerHTML = figFor(step);
    el.phaseLabel.textContent = step.ko;
    el.nowName.textContent = step.ko;
    el.nowSide.textContent = step.side || '';
    el.nowDur.innerHTML = `${step.dur}<span>s</span>`;
    el.nextCard.hidden = true;
  } else {
    el.figure.innerHTML = '';
    el.phaseLabel.textContent = step.ko;
    const nx = nextWorkStep(S.i);
    if (nx){
      el.nextName.textContent = nx.ko;
      el.nextLabel.textContent = nx.side ? `다음 · ${nx.side}` : '다음';
      el.nextFigure.innerHTML = shot(nx.fig, nx.ko, { small:true, flip: needsFlip(nx) });
      el.nowName.textContent = nx.ko;
      el.nowSide.textContent = nx.side || '';
      el.nowDur.innerHTML = `${nx.dur}<span>s</span>`;
      el.nextCard.hidden = false;
    } else {
      el.nextCard.hidden = true;
      el.nowName.textContent = '마지막';
      el.nowSide.textContent = '';
    }
  }
  el.ringText.classList.remove('pulse');
  void el.ringText.offsetWidth;
  el.ringText.classList.add('pulse');
  paintThemeColor();
}

function announce(step){
  const c = cfg;
  let txt = '';
  if (step.kind === 'prep')    txt = '준비하세요';
  else if (step.kind === 'work') txt = (step.side ? step.side + ' ' : '') + step.say + ', ' + step.dur + '초';
  else if (step.kind === 'rest') { const nx = nextWorkStep(S.i); txt = '휴식' + (nx ? ', 다음은 ' + (nx.side ? nx.side + ' ' : '') + nx.say : ''); }
  else if (step.kind === 'switch') txt = '다리를 바꾸세요';
  else if (step.kind === 'setrest') txt = '세트 완료, 휴식. 다음은 ' + (step.set + 2) + '세트';
  if (txt) Voice.say(txt);
  if (step.kind === 'work'){ Audio_.go(); buzz([0, 90, 60, 90]); }
  else buzz(45);
}

/* ---------- engine ---------- */
function startStep(i){
  S.i = i;
  const step = S.steps[i];
  S.stepDur = step.dur;
  S.remain = step.dur;
  S.endAt = performance.now() + step.dur * 1000;
  S.lastBeepSec = -1;
  paintStep();
  announce(step);
  tickPaint(step.dur, step.dur);
}

function tickPaint(remain, dur){
  const shown = Math.max(0, Math.ceil(remain - 0.001));
  el.bigCount.textContent = shown;
  const p = dur > 0 ? Math.max(0, Math.min(1, remain / dur)) : 0;
  el.ringFg.style.strokeDashoffset = String(RING_LEN * (1 - p));
  el.ringFg.classList.toggle('warn', remain <= cfg.bell && cfg.bell > 0);

  // total remaining across the whole workout
  let rest = remain;
  for (let k = S.i + 1; k < S.steps.length; k++) rest += S.steps[k].dur;
  el.totalLeft.textContent = mmss(rest);
}

function loop(){
  if (!S.running || S.paused) return;
  const now = performance.now();
  let remain = (S.endAt - now) / 1000;

  if (remain <= 0){
    const finishedIdx = S.i;
    if (finishedIdx + 1 >= S.steps.length){ finishWorkout(); return; }
    startStep(finishedIdx + 1);
    S.raf = requestAnimationFrame(loop);
    return;
  }

  // countdown bells
  const secLeft = Math.ceil(remain - 0.001);
  if (cfg.bell > 0 && secLeft <= cfg.bell && secLeft >= 1 && secLeft !== S.lastBeepSec){
    S.lastBeepSec = secLeft;
    Audio_.tick(secLeft);
    if (cfg.sayCount) Voice.say(String(secLeft), { rate: 1.35 });
    buzz(secLeft <= 1 ? 90 : 35);
    el.ringText.classList.remove('beat');
    void el.ringText.offsetWidth;
    el.ringText.classList.add('beat');
  }

  tickPaint(remain, S.stepDur);
  S.raf = requestAnimationFrame(loop);
}

function startWorkout(){
  Audio_.init(); Voice.init(); Audio_.startKeepAlive();
  S.steps = buildPlan(cfg);
  if (!S.steps.length) return;
  S.running = true; S.paused = false;
  S.startedAt = Date.now();
  renderSegments();
  show('workout');
  lockScreen();
  startStep(0);
  cancelAnimationFrame(S.raf);
  S.raf = requestAnimationFrame(loop);
}

function jump(delta){
  if (!S.running) return;
  let n = S.i + delta;
  if (n < 0) n = 0;
  if (n >= S.steps.length){ finishWorkout(); return; }
  startStep(n);
  if (S.paused) resume();
}

function pause(){
  if (!S.running || S.paused) return;
  S.paused = true;
  S.pauseAt = performance.now();
  cancelAnimationFrame(S.raf);
  Voice.stop();
  unlockScreen();
  el.pauseVeil.hidden = false;
}
function resume(){
  if (!S.running || !S.paused) return;
  const drift = performance.now() - S.pauseAt;
  S.endAt += drift;
  S.paused = false;
  el.pauseVeil.hidden = true;
  Audio_.applySession(); Audio_.resume(); Audio_.startKeepAlive(); lockScreen();
  S.raf = requestAnimationFrame(loop);
}
function stopWorkout(){
  Audio_.stopKeepAlive();
  S.running = false; S.paused = false;
  cancelAnimationFrame(S.raf);
  Voice.stop(); unlockScreen();
  el.pauseVeil.hidden = true;
}
function finishWorkout(){
  const secs = Math.round((Date.now() - S.startedAt) / 1000);
  stopWorkout();
  Audio_.done();
  Voice.say('운동 완료. 수고하셨습니다');
  buzz([0, 120, 80, 120, 80, 200]);
  el.doneTime.textContent = mmss(secs);
  el.doneSets.textContent = cfg.sets;
  show('done');
}

/* ---------- navigation ---------- */
function show(name){
  ['home','workout','done'].forEach(k => el[k].classList.toggle('is-active', k === name));
  paintThemeColor();
}

/* ---------- settings sheet ---------- */
const FIELDS = EXERCISES.map(e => e.id).concat(['switchTime','restEx','restSet','sets','prep','bell']);
const FIELD_EL = Object.assign(
  Object.fromEntries(EXERCISES.map(e => [e.id, 's_' + e.id])),
  { switchTime:'s_switch', restEx:'s_restEx', restSet:'s_restSet', sets:'s_sets', prep:'s_prep', bell:'s_bell' });
const TOGGLES = { beep:'s_beep', voice:'s_voice', vibe:'s_vibe', sayCount:'s_sayCount', silentBell:'s_silentBell' };

function fillSettings(){
  FIELDS.forEach(k => { $(FIELD_EL[k]).value = cfg[k]; });
  Object.keys(TOGGLES).forEach(k => { $(TOGGLES[k]).checked = !!cfg[k]; });
  el.themeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.theme === cfg.theme));
  syncSoundIcon();
}
function readField(k){
  const input = $(FIELD_EL[k]);
  let v = Math.round(+input.value);
  if (!Number.isFinite(v)) v = DEFAULTS[k];
  v = clamp(k, v);
  input.value = v;
  cfg[k] = v;
  save(); renderHome();
}
function openSheet(){ fillSettings(); showUpdateNote(); checkForUpdate(); el.sheet.classList.add('is-open'); el.scrim.classList.add('is-on'); }
function closeSheet(){ el.sheet.classList.remove('is-open'); el.scrim.classList.remove('is-on'); }
// What the system actually hands the page, read straight from env() rather than from
// the custom properties, so the raw system values are always visible.
function readInsets(){
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const ps = getComputedStyle(probe);
  const out = {
    top: Math.round(parseFloat(ps.paddingTop) || 0),
    bottom: Math.round(parseFloat(ps.paddingBottom) || 0),
  };
  probe.remove();
  return out;
}

// Height of the page. iOS has lied about this in both directions on the same phone:
// 793 on an 852 screen while the web view sat at the top (v1.9 stretched to 852 and
// WebKit sliced the start button off at 793), then over-reported so the page came out
// ~60px too long and pushed the buttons off the bottom entirely. So no single number is
// trusted: the smallest credible one wins, because a page shorter than the screen only
// wastes a strip, while a page longer than it hides its own controls. fitFooter() then
// checks the result against the laid-out page and trims whatever is still hanging over.
let viewShort = 0;
function setViewportHeight(){
  const ins = readInsets();
  const portrait = window.innerHeight >= window.innerWidth;
  const screenH = portrait ? Math.max(screen.width, screen.height)
                           : Math.min(screen.width, screen.height);
  let standalone = false;
  try{ standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }catch(e){}
  const cands = [window.innerHeight, document.documentElement.clientHeight,
                 window.visualViewport && window.visualViewport.height, screenH]
    .filter(v => typeof v === 'number' && isFinite(v) && v > 320);
  const h = Math.round(Math.min.apply(null, cands));
  // when the web view stops short of the screen bottom, the home indicator sits in that
  // gap, outside the page, and reserving room for it inside would waste the space twice
  viewShort = standalone ? Math.max(0, Math.round(screenH - h)) : 0;
  const root = document.documentElement.style;
  root.setProperty('--page-h', h + 'px');
  root.setProperty('--vh', (h / 100) + 'px');
  root.setProperty('--safe-b', (viewShort >= ins.bottom ? 0 : ins.bottom) + 'px');
}

// Last line of defence: whatever the system claimed, the buttons have to be on screen.
function fitFooter(){
  const foot = document.querySelector('#home .home-foot');
  if (!foot || !el.home.classList.contains('is-active')) return;
  const limit = Math.min(window.innerHeight || Infinity,
                         document.documentElement.clientHeight || Infinity);
  if (!isFinite(limit)) return;
  const over = Math.round(foot.getBoundingClientRect().bottom - limit);
  if (over > 0){
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-h')) || limit;
    const next = Math.max(320, cur - over);
    document.documentElement.style.setProperty('--page-h', next + 'px');
    document.documentElement.style.setProperty('--vh', (next / 100) + 'px');
  }
}

function relayout(){ setViewportHeight(); fitFooter(); }

// The settings list is the layout: the two dividers are rows of their own, so dragging
// an exercise past one is what moves it in or out of the repeat block. The top caption
// is fixed — it only labels the space above the first divider.
function renderExerciseRows(){
  // no counts on these lines: the set count is a stepper further down the same sheet,
  // and warm-up and cool-down run once by definition
  const cap = (txt, div) =>
    `<div class="sort-cap${div ? ' sort-div' : ''}"${div ? ` data-div="${div}"` : ''}>` +
    `<span>${txt}</span></div>`;
  const out = [cap('웜업')];
  layoutIds().forEach(id => {
    if (id === D_LOOP) return out.push(cap('반복', D_LOOP));
    if (id === D_COOL) return out.push(cap('마무리', D_COOL));
    const e = byId(id);
    if (!e) return;
    const off = isOff(id);
    out.push(`<div class="row sort-row${off ? ' is-off' : ''}" data-ex="${e.id}">
      <button class="drag-handle" type="button" aria-label="${e.ko} 순서 변경" tabindex="-1">
        <svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14"/></svg>
      </button>
      <button class="ex-on" type="button" data-on="${e.id}" aria-pressed="${!off}" aria-label="${e.ko} ${off ? '켜기' : '끄기'}">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
      <label for="s_${e.id}">${e.ko}${e.perSide ? ' <small>한쪽</small>' : ''}</label>
      <span class="off-tag">꺼짐</span>
      <div class="stepper" data-for="s_${e.id}">
        <button type="button" data-d="-5">−</button>
        <input id="s_${e.id}" type="number" inputmode="numeric" min="${LIMITS[e.id][0]}" max="${LIMITS[e.id][1]}" step="5">
        <button type="button" data-d="5">+</button><i>초</i>
      </div>
    </div>`);
  });
  el.exRows.innerHTML = out.join('');
  syncLoopNote();
}
function syncLoopNote(){
  if (el.loopNote) el.loopNote.hidden = zones().loop.length > 0;
}

/* ---------- drag to reorder ---------- */
function initSortable(list){
  let rows = [], rects = [], from = -1, to = -1, el0 = null, startY = 0, step = 0, pid = null;

  const shift = () => rows.forEach((r, i) => {
    if (r === el0) return;
    let d = 0;
    if (to > from && i > from && i <= to) d = -step;
    else if (to < from && i >= to && i < from) d = step;
    r.style.transform = d ? `translateY(${d}px)` : '';
  });

  const onDown = e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || pid !== null) return;
    el0 = handle.closest('.sort-row');
    if (!el0) return;
    e.preventDefault();
    rows = [...list.querySelectorAll('.sort-row, .sort-div')];
    rects = rows.map(r => r.getBoundingClientRect());
    from = to = rows.indexOf(el0);
    const gap = rows.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 8;
    step = rects[from].height + gap;        // how far the rows in between slide
    startY = e.clientY;
    pid = e.pointerId;
    handle.setPointerCapture(pid);
    list.classList.add('is-sorting');
    el0.classList.add('is-dragging');
    buzz(12);
  };

  const onMove = e => {
    if (pid === null || e.pointerId !== pid) return;
    e.preventDefault();
    const dy = e.clientY - startY;
    el0.style.transform = `translateY(${dy}px)`;
    // hand over the slot once the dragged row's centre crosses a neighbour's near
    // edge — waiting for its centre would let the two rows overlap on the way
    const mid = rects[from].top + rects[from].height / 2 + dy;
    let t = from;
    for (let i = from + 1; i < rows.length; i++){ if (mid > rects[i].top) t = i; else break; }
    for (let i = from - 1; i >= 0; i--){ if (mid < rects[i].bottom) t = i; else break; }
    if (t !== to){ to = t; shift(); buzz(8); }

    // nudge the sheet when dragging against either edge
    const box = el.sheetBody.getBoundingClientRect();
    if (e.clientY < box.top + 60) el.sheetBody.scrollTop -= 8;
    else if (e.clientY > box.bottom - 60) el.sheetBody.scrollTop += 8;
  };

  const onUp = e => {
    if (pid === null || (e && e.pointerId !== undefined && e.pointerId !== pid)) return;
    pid = null;
    list.classList.remove('is-sorting');
    el0.classList.remove('is-dragging');
    rows.forEach(r => { r.style.transform = ''; });
    if (to !== from){
      const ids = rows.map(r => r.dataset.ex || r.dataset.div);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      list.insertBefore(el0, rows[to > from ? to + 1 : to] || null);
      setOrder(ids);
      syncLoopNote();
      buzz(24);
    }
    el0 = null; from = to = -1;
  };

  list.addEventListener('pointerdown', onDown);
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerup', onUp);
  list.addEventListener('pointercancel', onUp);
}

function syncSoundIcon(){
  const on = cfg.beep || cfg.voice;
  el.btnSound.classList.toggle('muted', !on);
}

/* ---------- events ---------- */
el.btnStart.addEventListener('click', startWorkout);
el.btnSettings.addEventListener('click', () => { Audio_.init(); openSheet(); });
el.btnSheetClose.addEventListener('click', closeSheet);
el.scrim.addEventListener('click', closeSheet);

const fieldOf = id => FIELDS.find(k => FIELD_EL[k] === id);
document.addEventListener('click', e => {
  const btn = e.target.closest('.stepper button');
  if (!btn) return;
  const st = btn.closest('.stepper');
  const key = fieldOf(st.dataset.for);
  if (!key) return;
  const input = $(st.dataset.for);
  input.value = clamp(key, Math.round(+input.value || 0) + (+btn.dataset.d));
  readField(key);
  buzz(10);
});
['change', 'focusout'].forEach(type => document.addEventListener(type, e => {
  const input = e.target.closest && e.target.closest('.stepper input');
  if (!input) return;
  const key = fieldOf(input.id);
  if (key) readField(key);
}, true));

Object.keys(TOGGLES).forEach(k => {
  $(TOGGLES[k]).addEventListener('change', e => {
    cfg[k] = e.target.checked; save(); syncSoundIcon();
    if (k === 'voice' && cfg.voice){ Audio_.init(); Voice.init(); Voice.say('음성 안내 켜짐'); }
    if (k === 'beep' && cfg.beep){ Audio_.init(); setTimeout(() => Audio_.tick(), 60); }
    if (k === 'vibe' && cfg.vibe) buzz(40);
    if (k === 'silentBell'){ Audio_.init(); Audio_.applySession(); Audio_.tick(2); }
    if (k === 'sayCount' && cfg.sayCount){ Voice.init(); Voice.say('3', { rate:1.35 }); }
  });
});
el.themeSeg.addEventListener('click', e => {
  const b = e.target.closest('button[data-theme]');
  if (!b) return;
  cfg.theme = b.dataset.theme; save(); applyTheme(); buzz(10);
});
el.exRows.addEventListener('click', e => {
  const b = e.target.closest('.ex-on');
  if (!b) return;
  toggleExercise(b.dataset.on);
  buzz(12);
});
el.btnTestSound.addEventListener('click', () => {
  Audio_.init(); Voice.init();
  Audio_.tick();
  setTimeout(() => Audio_.tick(), 450);
  setTimeout(() => { Audio_.go(); Voice.say('월싯, ' + cfg.wallSit + '초'); }, 900);
});
el.btnReset.addEventListener('click', () => {
  cfg = { ...DEFAULTS }; save(); renderExerciseRows(); fillSettings(); applyTheme(); renderHome();
});

// Reload past every cache. A plain location.reload() is not enough on iOS: the web app
// re-serves the stored index.html, which then pulls the matching old css/js. A URL the
// cache has never seen is, so this navigates to one. Settings live in localStorage and
// are untouched.
function hardReload(){
  const jobs = [];
  try{
    if (window.caches && caches.keys)
      jobs.push(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
  }catch(e){}
  try{
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
      jobs.push(navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))));
  }catch(e){}
  Promise.all(jobs).catch(() => {}).then(() => {
    let url = location.href.split('#')[0].replace(/([?&])r=\d+&?/g, '$1').replace(/[?&]$/, '');
    url += (url.includes('?') ? '&' : '?') + 'r=' + Date.now();
    location.replace(url);
  });
}

/* ---------- staying up to date ---------- */
// A home-screen icon added from Safari starts from Safari's cache, so the very first
// launch of a freshly added icon can still be an old build — that trap cost a round of
// re-installs. The live version is read out of index.html itself (fetched past the
// cache) rather than from a second file, so there is still only one place to bump it.
const UPD_NOTE = el.updNote ? el.updNote.textContent : '';
let latestBuild = null, updateReady = false;

function showUpdateNote(){
  if (!el.updNote) return;
  if (updateReady) el.updNote.textContent = `새 버전 v${latestBuild} 을 받아옵니다…`;
  else if (latestBuild) el.updNote.textContent = '최신 버전입니다. 업데이트해도 설정값은 유지됩니다.';
  else el.updNote.textContent = UPD_NOTE;
}

function checkForUpdate(manual){
  if (BUILD === 'dev' || navigator.onLine === false){
    if (manual && el.updNote) el.updNote.textContent = '지금은 확인할 수 없습니다. 연결을 확인해 주세요.';
    return;
  }
  fetch('index.html?probe=' + Date.now(), { cache: 'no-store' })
    .then(res => res.ok ? res.text() : null)
    .then(text => {
      const m = text && text.match(/app\.js\?v=([^"'&]+)/);
      if (!m) return;
      latestBuild = m[1];
      updateReady = latestBuild !== BUILD;
      showUpdateNote();
      if (!updateReady) return;
      // swap to it straight away when nothing is in progress; never interrupt a workout.
      // a tap on the version row is the exception: it asked for this, sheet open or not
      if (!manual && (el.workout.classList.contains('is-active') || el.sheet.classList.contains('is-open'))) return;
      let already = null;
      try{ already = sessionStorage.getItem('autoUpdate'); }catch(e){}
      if (!manual && already === latestBuild) return;   // one try per version, so a stale edge
      try{ sessionStorage.setItem('autoUpdate', latestBuild); }catch(e){}  // cannot loop
      hardReload();
    })
    .catch(() => { if (manual && el.updNote) el.updNote.textContent = '지금은 확인할 수 없습니다. 연결을 확인해 주세요.'; });
}

el.verRow.addEventListener('click', () => {
  el.updNote.textContent = '확인 중…';
  checkForUpdate(true);
});

el.btnNext.addEventListener('click', () => { Audio_.init(); jump(1); });
el.btnPrev.addEventListener('click', () => { Audio_.init(); jump(-1); });
el.btnClose.addEventListener('click', () => { S.paused ? resume() : pause(); });
el.btnSound.addEventListener('click', () => {
  const on = cfg.beep || cfg.voice;
  cfg.beep = !on; cfg.voice = !on; save(); syncSoundIcon();
  if (!on){ Audio_.init(); Audio_.tick(); }
  else Voice.stop();
});
el.btnResume.addEventListener('click', resume);
el.btnQuit.addEventListener('click', () => { stopWorkout(); show('home'); });
el.btnAgain.addEventListener('click', startWorkout);
el.btnHome.addEventListener('click', () => show('home'));

// tap the middle of the stage to pause / resume
document.querySelector('.wk-stage').addEventListener('click', () => { S.paused ? resume() : pause(); });

// keyboard (desktop convenience)
window.addEventListener('keydown', e => {
  if (!el.workout.classList.contains('is-active')) return;
  if (e.code === 'Space'){ e.preventDefault(); S.paused ? resume() : pause(); }
  if (e.code === 'ArrowRight') jump(1);
  if (e.code === 'ArrowLeft') jump(-1);
});

// keep voices list warm
if ('speechSynthesis' in window){
  speechSynthesis.onvoiceschanged = () => {};
  try{ speechSynthesis.getVoices(); }catch(e){}
}

// avoid double-tap zoom / pull-to-refresh
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  const t = e.target;
  const inScroller = t && t.closest && t.closest('.sheet-body, .home-body');
  if (!inScroller) e.preventDefault();
}, { passive:false });

window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
// iOS settles the web view's size after load, and again when the app is resumed
window.addEventListener('pageshow', relayout);
document.addEventListener('visibilitychange', () => { if (!document.hidden){ relayout(); checkForUpdate(); } });

/* ---------- boot ---------- */
setViewportHeight();
if (el.appVer) el.appVer.textContent = 'v' + BUILD;
Audio_.applySession();
el.ringFg.style.strokeDasharray = String(RING_LEN);
applyTheme();
preloadShots();
renderExerciseRows();
initSortable(el.exRows);
fillSettings();
renderHome();
show('home');
requestAnimationFrame(fitFooter);
setTimeout(relayout, 400);
setTimeout(checkForUpdate, 900);

})();
