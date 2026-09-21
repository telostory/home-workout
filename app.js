/* =========================================================
   러닝 근력 트레이닝 — single-page workout timer
   ========================================================= */
(() => {
'use strict';

/* ---------- config ---------- */
const STORE_KEY = 'runner-strength-v1';
const DEFAULTS = {
  wallSit: 40, hipBridge: 40, legRaise: 20, switchTime: 5,
  restEx: 10, restSet: 30, sets: 3, prep: 10,
  bell: 5, beep: true, voice: true, vibe: true, silentBell: true, sayCount: true,
  theme: 'system',
};
const THEMES = ['system', 'light', 'dark'];
const LIMITS = {
  wallSit:[5,300], hipBridge:[5,300], legRaise:[5,300], switchTime:[0,60],
  restEx:[0,300], restSet:[0,600], sets:[1,10], prep:[0,60], bell:[0,10],
};

let cfg = load();

function load(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)){
      if (!(k in raw)) continue;
      if (typeof DEFAULTS[k] === 'boolean') out[k] = !!raw[k];
      else if (typeof DEFAULTS[k] === 'string') out[k] = String(raw[k]);
      else if (Number.isFinite(+raw[k])) out[k] = clamp(k, Math.round(+raw[k]));
    }
    if (!THEMES.includes(out.theme)) out.theme = DEFAULTS.theme;
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
  wallSit:   { src:'img/wall-sit.webp',       w:534, h:960, sm:'img/wall-sit-sm.webp',       smW:133, smH:240 },
  hipBridge: { src:'img/hip-bridge.webp',     w:960, h:365, sm:'img/hip-bridge-sm.webp',     smW:240, smH:91  },
  legRaise:  { src:'img/side-leg-raise.webp', w:960, h:361, sm:'img/side-leg-raise-sm.webp', smW:240, smH:90  },
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
  { id:'wallSit',   ko:'월 싯',            en:'Wall Sit',        say:'월싯',              desc:'허벅지 앞·코어',      fig:'wallSit'   },
  { id:'hipBridge', ko:'힙 브릿지',         en:'Hip Bridge',      say:'힙 브릿지',          desc:'둔근·햄스트링',      fig:'hipBridge' },
  { id:'legRaise',  ko:'사이드 레그 레이즈', en:'Side Leg Raise',  say:'사이드 레그 레이즈', desc:'중둔근 (양쪽)',      fig:'legRaise', perSide:true, shotSide:'왼쪽' },
];
const byId = id => EXERCISES.find(e => e.id === id);

/* ---------- plan builder ---------- */
function buildPlan(c){
  const steps = [];
  const ex = { wallSit:c.wallSit, hipBridge:c.hipBridge, legRaise:c.legRaise };
  if (c.prep > 0) steps.push({ kind:'prep', dur:c.prep, ko:'준비하세요', set:0, exIdx:0 });

  for (let s = 0; s < c.sets; s++){
    const last = s === c.sets - 1;
    // 1. wall sit
    steps.push(work('wallSit', ex.wallSit, s, 1));
    if (c.restEx > 0) steps.push({ kind:'rest', dur:c.restEx, ko:'휴식', set:s, exIdx:1 });
    // 2. hip bridge
    steps.push(work('hipBridge', ex.hipBridge, s, 2));
    if (c.restEx > 0) steps.push({ kind:'rest', dur:c.restEx, ko:'휴식', set:s, exIdx:2 });
    // 3. side leg raise (both sides)
    steps.push(work('legRaise', ex.legRaise, s, 3, '오른쪽'));
    if (c.switchTime > 0) steps.push({ kind:'switch', dur:c.switchTime, ko:'다리 바꾸기', set:s, exIdx:3 });
    steps.push(work('legRaise', ex.legRaise, s, 3, '왼쪽'));
    if (!last && c.restSet > 0) steps.push({ kind:'setrest', dur:c.restSet, ko:'세트 휴식', set:s, exIdx:3 });
  }
  return steps;

  function work(id, dur, set, exIdx, side){
    const e = byId(id);
    return { kind:'work', id, dur, set, exIdx, side, ko:e.ko, en:e.en, say:e.say, fig:e.fig, shotSide:e.shotSide };
  }
}
const totalOf = steps => steps.reduce((a, s) => a + s.dur, 0);
const mmss = s => {
  s = Math.max(0, Math.round(s));
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
};

/* ---------- audio ---------- */
const Audio_ = {
  ctx: null,
  // iOS mutes Web Audio when the ring/silent switch is on, but not speech.
  // Declaring a playback session lets the bells through anyway (iOS 16.4+).
  applySession(){
    try{
      if (navigator.audioSession) navigator.audioSession.type = cfg.silentBell ? 'playback' : 'auto';
    }catch(e){}
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
  beep(freq = 880, dur = 0.14, vol = 0.32, type = 'sine'){
    if (!cfg.beep || !this.ctx) return;
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
      speechSynthesis.speak(u);
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
  figure: $('figure'), ringFg: $('ringFg'), ringText: document.querySelector('.ring-text'),
  bigCount: $('bigCount'), phaseLabel: $('phaseLabel'),
  nextCard: $('nextCard'), nextName: $('nextName'), nextFigure: $('nextFigure'),
  nowDur: $('nowDur'), nowName: $('nowName'), nowSide: $('nowSide'),
  btnPrev: $('btnPrev'), btnNext: $('btnNext'), btnClose: $('btnClose'), btnSound: $('btnSound'),
  pauseVeil: $('pauseVeil'), btnResume: $('btnResume'), btnQuit: $('btnQuit'),
  doneTime: $('doneTime'), doneSets: $('doneSets'), btnAgain: $('btnAgain'), btnHome: $('btnHome'),
  sheet: $('settings'), scrim: $('scrim'), btnSheetClose: $('btnSettingsClose'),
  btnTestSound: $('btnTestSound'), btnReset: $('btnReset'),
  themeSeg: $('themeSeg'), themeColor: $('themeColor'), audioInfo: $('audioInfo'),
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
  const total = totalOf(steps);
  el.planList.innerHTML = EXERCISES.map(e => {
    const per = cfg[e.id];
    const label = e.perSide
      ? `${per}초 × 좌우`
      : `${per}초`;
    return `<li>
      <div class="pic">${shot(e.fig, e.ko, { small:true })}</div>
      <div class="tx"><b>${e.ko}</b><small>${e.desc}</small></div>
      <div class="tm">${label}</div>
    </li>`;
  }).join('');
  el.metaSets.textContent = cfg.sets;
  el.metaTime.textContent = mmss(total).replace(/^0/, '');
  el.metaMoves.textContent = EXERCISES.length;
}

/* ---------- workout rendering ---------- */
function renderSegments(){
  el.segments.innerHTML = '';
  for (let s = 0; s < cfg.sets; s++){
    const g = document.createElement('div');
    g.className = 'seg-group';
    for (let e = 0; e < EXERCISES.length; e++){
      const d = document.createElement('div');
      d.className = 'seg';
      d.dataset.set = s; d.dataset.ex = e + 1;
      g.appendChild(d);
    }
    el.segments.appendChild(g);
  }
}
function updateSegments(step){
  // an exercise counts as finished once we reach the rest that follows it
  const inProgress = step.kind === 'work' || step.kind === 'switch';
  const finished = step.set * EXERCISES.length + (inProgress ? step.exIdx - 1 : step.exIdx);
  const current = inProgress ? finished + 1 : 0;
  [...el.segments.querySelectorAll('.seg')].forEach((d, idx) => {
    const n = idx + 1;
    d.classList.toggle('done', n <= finished);
    d.classList.toggle('now', n === current);
  });
}

function figFor(step){
  return step.kind === 'work' ? shot(step.fig, step.ko, { flip: needsFlip(step) }) : '';
}
function setViewportHeight(){
  const h = window.innerHeight;
  document.documentElement.style.setProperty('--app-h', h + 'px');
  document.documentElement.style.setProperty('--vh', (h / 100) + 'px');
}
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

  el.cRound.textContent = Math.min(cfg.sets, step.set + 1);
  el.cRoundT.textContent = cfg.sets;
  el.cEx.textContent = Math.max(1, step.exIdx);
  el.cExT.textContent = EXERCISES.length;

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
      el.nextName.textContent = nx.ko + (nx.side ? ` (${nx.side})` : '');
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
  Audio_.init(); Voice.init();
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
  Audio_.resume(); lockScreen();
  S.raf = requestAnimationFrame(loop);
}
function stopWorkout(){
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
const FIELDS = ['wallSit','hipBridge','legRaise','switchTime','restEx','restSet','sets','prep','bell'];
const FIELD_EL = {
  wallSit:'s_wallSit', hipBridge:'s_hipBridge', legRaise:'s_legRaise', switchTime:'s_switch',
  restEx:'s_restEx', restSet:'s_restSet', sets:'s_sets', prep:'s_prep', bell:'s_bell',
};
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
function openSheet(){ fillSettings(); showAudioInfo(); el.sheet.classList.add('is-open'); el.scrim.classList.add('is-on'); }
function closeSheet(){ el.sheet.classList.remove('is-open'); el.scrim.classList.remove('is-on'); }
// plain-language report of what this device actually supports
function showAudioInfo(){
  if (!el.audioInfo) return;
  const bits = [];
  const sess = (typeof navigator !== 'undefined') && navigator.audioSession;
  bits.push(sess ? `무음 우회 ${sess.type === 'playback' ? '켜짐' : '가능(꺼짐)'}` : '무음 우회 미지원');
  bits.push(`오디오 ${Audio_.ctx ? Audio_.ctx.state : '미시작'}`);
  if ('speechSynthesis' in window){
    const v = Voice.pickVoice();
    bits.push(v ? `음성 ${v.name}` : '음성 한국어 없음');
  } else bits.push('음성 미지원');
  el.audioInfo.textContent = bits.join(' · ');
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

FIELDS.forEach(k => {
  const input = $(FIELD_EL[k]);
  input.addEventListener('change', () => readField(k));
  input.addEventListener('blur', () => readField(k));
});
document.querySelectorAll('.stepper').forEach(st => {
  const key = FIELDS.find(k => FIELD_EL[k] === st.dataset.for);
  st.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const input = $(st.dataset.for);
      input.value = clamp(key, Math.round(+input.value || 0) + (+b.dataset.d));
      readField(key);
      buzz(10);
    });
  });
});
Object.keys(TOGGLES).forEach(k => {
  $(TOGGLES[k]).addEventListener('change', e => {
    cfg[k] = e.target.checked; save(); syncSoundIcon();
    if (k === 'voice' && cfg.voice){ Audio_.init(); Voice.init(); Voice.say('음성 안내 켜짐'); }
    if (k === 'beep' && cfg.beep){ Audio_.init(); setTimeout(() => Audio_.tick(), 60); }
    if (k === 'vibe' && cfg.vibe) buzz(40);
    if (k === 'silentBell'){ Audio_.init(); Audio_.applySession(); Audio_.tick(2); showAudioInfo(); }
    if (k === 'sayCount' && cfg.sayCount){ Voice.init(); Voice.say('3', { rate:1.35 }); }
  });
});
el.themeSeg.addEventListener('click', e => {
  const b = e.target.closest('button[data-theme]');
  if (!b) return;
  cfg.theme = b.dataset.theme; save(); applyTheme(); buzz(10);
});
el.btnTestSound.addEventListener('click', () => {
  Audio_.init(); Voice.init();
  Audio_.tick();
  setTimeout(() => Audio_.tick(), 450);
  setTimeout(() => { Audio_.go(); Voice.say('월싯, ' + cfg.wallSit + '초'); }, 900);
  setTimeout(showAudioInfo, 300);
});
el.btnReset.addEventListener('click', () => {
  cfg = { ...DEFAULTS }; save(); fillSettings(); applyTheme(); renderHome();
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
  const inSheet = t && t.closest && t.closest('.sheet-body');
  if (!inSheet) e.preventDefault();
}, { passive:false });

window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 250));

/* ---------- boot ---------- */
setViewportHeight();
el.ringFg.style.strokeDasharray = String(RING_LEN);
applyTheme();
preloadShots();
fillSettings();
renderHome();
show('home');

})();
