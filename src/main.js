import './style.css';
import { ACTIONS, CAST, DEMO, EMOTIONS, clamp, compileScene, sampleScene } from './performance.js';
import { CAMERAS, LIGHTS, Stage } from './stage.js';
import { MandarinVoice } from './voice.js';

const $ = id => document.getElementById(id);
const narrowView = matchMedia('(max-width: 760px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const captionRanges = new WeakMap();
const FRAME_STEP = 1 / 24;
const icons = {
  play: '<path d="M8 4.9v14.2L19 12 8 4.9Z" fill="currentColor" stroke-width="1.4"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  previous: '<path d="M5 5v14M18 6l-9 6 9 6z"/>',
  next: '<path d="M19 5v14M6 6l9 6-9 6z"/>',
  sound: '<path d="M3 9v6h4l5 4V5L7 9H3Zm13-1a5.6 5.6 0 0 1 0 8m2-10a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M3 9v6h4l5 4V5L7 9H3Zm13 1 5 5m0-5-5 5"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M11 10a2.4 2.4 0 1 0 0 4m6-4a2.4 2.4 0 1 0 0 4"/>',
  expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m8 0h4v-4"/>',
  reset: '<path d="M4 10a8 8 0 1 1 .8 6M4 10V4m0 6h6"/>',
  sliders: '<path d="M5 3v6m0 4v8m7-18v11m0 4v3m7-18v3m0 4v11M2 10h6m1 5h6m1-8h6"/>',
  script: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  face: '<path d="M5 5h14v9a7 7 0 0 1-14 0V5Zm3 5h2m4 0h2m-7 5q3 3 6 0"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

$('previous').innerHTML = icon('previous');
$('next').innerHTML = icon('next');
$('fullscreen').innerHTML = icon('expand');
$('captions-toggle').innerHTML = icon('captions');
$('direction-icon').innerHTML = icon('sliders');
$('script-icon').innerHTML = icon('script');
$('gallery-icon').innerHTML = icon('face');
$('load-demo').innerHTML = icon('reset') + '载入示例';
$('perform').innerHTML = icon('play') + '开始表演';
$('run-script').innerHTML = icon('play') + '排演剧本';

let stage;
try {
  stage = new Stage($('stage'));
} catch (error) {
  console.error(error);
  $('render-error').hidden = false;
}
const state = {
  scene: compileScene(DEMO), source: 'demo', time: 0, playing: false, camera: 'auto', lighting: 'auto', tab: 'live',
  captions: true, liveActor: CAST[0], liveEmotion: 'tender', portrait: null, portraitActor: CAST[0], portraitEmotion: 'neutral',
};
let dirty = true;
let lastFrame = 0;
let lastCue;
let lastShot = 'wide';
let lastSubtitle = -2;
let correction = 0;
let lastBeatNode;
let lastSegment;
const voice = new MandarinVoice(
  (beat, local) => {
    if (!state.playing || state.portrait || sampleScene(state.scene, state.time).beat !== beat) return;
    correction = clamp(beat.start + local - state.time, -0.40, 0.40);
  },
  message => {
    updateVoiceButton();
    notice('live-notice', message);
    if (message) {
      $('voice').title = message;
      $('voice').setAttribute('aria-label', message);
    }
  },
);

function notice(id, message) {
  $(id).hidden = !message;
  $(id).textContent = message;
}

function fillSelect(id, values, initial) {
  const select = $(id);
  for (const [value, name] of Object.entries(values)) select.append(new Option(name, value));
  select.value = initial;
}
fillSelect('gesture', { '': '自然站姿', ...ACTIONS }, 'reach');
fillSelect('camera', CAMERAS, state.camera);
fillSelect('lighting', LIGHTS, state.lighting);
$('script').value = DEMO;
$('line').value = '轻声！那边窗子里亮起来的是什么光？';

function choices(id, values, getSelected, onChange, content) {
  const root = $(id);
  const refresh = () => {
    for (const button of root.children) button.setAttribute('aria-pressed', button.dataset.value === getSelected());
  };
  for (const [value, label] of Object.entries(values)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    button.textContent = label;
    content?.(button, value);
    button.addEventListener('click', () => { onChange(value); refresh(); });
    root.append(button);
  }
  refresh();
  return refresh;
}
const actorLabels = Object.fromEntries(CAST.map(name => [name, name]));
const actorIcon = (button, value) => {
  const avatar = document.createElement('span');
  avatar.className = 'avatar' + (value === CAST[1] ? ' juliet' : '');
  avatar.innerHTML = icon('person');
  button.prepend(avatar);
};
choices('actor-options', actorLabels, () => state.liveActor, value => { state.liveActor = value; }, actorIcon);
choices('emotions', EMOTIONS, () => state.liveEmotion, value => { state.liveEmotion = value; });
const refreshPortraitActor = choices('gallery-actors', actorLabels, () => state.portraitActor, value => {
  state.portraitActor = value;
  setPortrait();
}, actorIcon);
const refreshPortraitEmotion = choices('gallery-emotions', EMOTIONS, () => state.portraitEmotion, value => {
  state.portraitEmotion = value;
  setPortrait();
}, (button, value) => {
  const tag = document.createElement('small');
  tag.textContent = value.toUpperCase();
  button.append(tag);
});

function setRange(id, output) {
  const input = $(id);
  $(output).value = `${input.value}%`;
  input.style.setProperty('--value', `${input.value}%`);
}
for (const [id, output] of [['intensity', 'strength'], ['gallery-intensity', 'gallery-strength']]) {
  setRange(id, output);
  $(id).addEventListener('input', () => {
    setRange(id, output);
    if (id === 'gallery-intensity') setPortrait();
  });
}

function timecode(time, padded = true) {
  const seconds = Math.floor(time);
  const min = String(Math.floor(seconds / 60));
  return `${padded ? min.padStart(2, '0') : min}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateVoiceButton() {
  const button = $('voice');
  button.setAttribute('aria-pressed', voice.enabled);
  button.title = voice.enabled ? '关闭朗读' : '开启本地中文朗读';
  button.setAttribute('aria-label', button.title);
  button.innerHTML = icon(voice.enabled ? 'sound' : 'mute');
}

function updateTransport() {
  $('play').innerHTML = icon(state.playing ? 'pause' : 'play');
  $('play').setAttribute('aria-label', state.playing ? '暂停' : '播放');
  $('stage-state').textContent = state.portrait ? '表情预览' : state.playing ? '表演中' : state.time === 0 ? '就绪' :
    state.time >= state.scene.duration ? '结束' : '已暂停';
  for (const id of ['play', 'previous', 'next', 'timeline', 'voice']) $(id).disabled = Boolean(state.portrait);
  $('caption').hidden = !state.captions && !state.portrait;
  $('captions-toggle').disabled = Boolean(state.portrait);
}

function rebuildTimeline() {
  $('cues').replaceChildren();
  $('line-list').replaceChildren();
  $('timeline').max = state.scene.duration;
  $('duration').textContent = timecode(state.scene.duration, false);
  $('beat-count').textContent = `${state.scene.beats.length} 句`;
  lastCue = null;
  lastBeatNode = null;
  lastSegment = null;
  for (const beat of state.scene.beats) {
    const segment = document.createElement('span');
    segment.style.flexGrow = beat.duration;
    segment.title = beat.speaker + ' · ' + timecode(beat.start);
    $('cues').append(segment);
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'cue-button';
    button.type = 'button';
    const timestamp = document.createElement('time');
    timestamp.textContent = timecode(beat.start);
    const speaker = document.createElement('strong');
    speaker.textContent = beat.speaker;
    const speech = document.createElement('span');
    speech.textContent = beat.line;
    button.append(timestamp, speaker, speech);
    button.addEventListener('click', () => {
      if (state.portrait) setTab('live');
      seek(beat.start);
    });
    row.append(button);
    $('line-list').append(row);
  }
}

function captionRange(beat, index) {
  if (!captionRanges.has(beat)) {
    const ends = [];
    let start = 0;
    for (const [i, unit] of beat.units.entries()) {
      const count = i - start + 1;
      if ((count >= 5 && /[。！？!?…]/u.test(unit.char)) || (count >= 12 && /[，；：、,]/u.test(unit.char)) || count >= 24) {
        ends.push(i + 1);
        start = i + 1;
      }
    }
    if (start < beat.units.length) ends.push(beat.units.length);
    captionRanges.set(beat, ends);
  }
  const ends = captionRanges.get(beat);
  const rangeIndex = ends.findIndex(end => index < end);
  const selected = rangeIndex < 0 ? ends.length - 1 : rangeIndex;
  return [ends[selected - 1] ?? 0, ends[selected]];
}

function updateFrame(frame) {
  const { beat, speech, camera } = frame;
  lastShot = camera;
  $('shot-label').textContent = CAMERAS[camera];
  if (state.portrait) {
    $('caption-speaker').textContent = state.portraitActor;
    $('caption-text').textContent = EMOTIONS[state.portraitEmotion];
    lastCue = null;
    return;
  }
  if (beat !== lastCue) {
    lastBeatNode?.removeAttribute('aria-current');
    lastSegment?.classList.remove('current');
    lastBeatNode = $('line-list').children[beat.index]?.firstElementChild;
    lastSegment = $('cues').children[beat.index];
    lastBeatNode?.setAttribute('aria-current', 'true');
    lastSegment?.classList.add('current');
    $('caption-speaker').textContent = beat.speaker;
    lastSubtitle = -2;
    lastCue = beat;
  }
  const activeChar = speech.index;
  if (lastSubtitle !== activeChar) {
    const [start, end] = captionRange(beat, activeChar);
    const spoken = document.createElement('span');
    const mark = document.createElement('mark');
    const upcoming = document.createElement('span');
    const text = (from, to) => beat.units.slice(from, to).map(unit => unit.char).join('');
    spoken.className = 'read';
    upcoming.className = 'unread';
    spoken.textContent = text(start, Math.max(start, activeChar));
    if (speech.talking) mark.textContent = beat.units[activeChar]?.char ?? '';
    else if (beat.units[activeChar]) spoken.textContent += beat.units[activeChar].char;
    upcoming.textContent = text(Math.max(start, activeChar + 1), end);
    $('caption-text').setAttribute('aria-label', text(start, end));
    $('caption-text').replaceChildren(spoken, mark, upcoming);
    lastSubtitle = activeChar;
  }
  $('timeline').value = state.time;
  $('timeline').setAttribute('aria-valuetext', timecode(state.time) + ' / ' + timecode(state.scene.duration));
  const fraction = String(Math.floor((state.time % 1) * 100)).padStart(2, '0');
  $('timecode').innerHTML = `${timecode(state.time)}<small>.${fraction}</small> <b>/</b> ${timecode(state.scene.duration)}`;
}

function render() {
  const portrait = state.portrait;
  const scene = portrait?.scene ?? state.scene;
  const time = portrait?.time ?? state.time;
  const mode = portrait && state.camera === 'auto' ? 'close' : state.camera;
  const sample = stage?.render(scene, time, mode, state.lighting, portrait, state.playing) ?? { ...sampleScene(scene, time), camera: mode === 'auto' ? 'wide' : mode };
  updateFrame(sample);
  dirty = false;
}

function seek(value, renderNow = false) {
  if (!Number.isFinite(value)) throw new TypeError('时间必须是有限数字');
  state.time = clamp(value, 0, state.scene.duration);
  if (state.time >= state.scene.duration) state.playing = false;
  voice.stop();
  correction = 0;
  updateTransport();
  dirty = true;
  if (renderNow) render();
  return state.time;
}

function play(enabled = true) {
  if (enabled && state.portrait) setTab('live');
  if (enabled && state.time >= state.scene.duration) seek(0);
  if (!enabled) voice.stop();
  state.playing = enabled;
  updateTransport();
  dirty = true;
}

function loadScene(source, { autoplay = false, kind = 'custom' } = {}) {
  const scene = compileScene(source);
  if (state.portrait) setTab('live');
  state.scene = scene;
  state.source = kind;
  const sample = kind === 'demo';
  $('scene-title').textContent = sample ? '罗密欧与朱丽叶' : kind === 'improv' ? '即兴排练' : '剧本排练';
  $('scene-context').textContent = sample ? 'WILLIAM SHAKESPEARE / 第二幕 · 第二场' : 'ACTOR STUDIO / 自定义场景';
  $('scene-note').textContent = sample ? '月下花园 · 阳台场景' : scene.cast.join(' · ');
  state.playing = false;
  seek(0);
  rebuildTimeline();
  if (autoplay) play();
  return scene.duration;
}

function setPortrait(time = 1.43) {
  const scene = compileScene([{
    speaker: state.portraitActor, line: '此刻，舞台只听见心跳。', emotion: state.portraitEmotion,
    intensity: Number($('gallery-intensity').value) / 100,
  }]);
  state.portrait = { scene, time: clamp(time, 0, scene.duration) };
  $('caption-text').removeAttribute('aria-label');
  updateTransport();
  dirty = true;
}

function setTab(tab) {
  state.tab = tab;
  for (const button of document.querySelectorAll('[data-tab]')) {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  for (const name of ['live', 'script', 'gallery']) $(name + '-panel').hidden = tab !== name;
  if (tab === 'gallery') {
    state.playing = false;
    voice.stop();
    setPortrait();
  } else {
    state.portrait = null;
    updateTransport();
    dirty = true;
  }
}

function setOptic(id, value, values) {
  if (!Object.hasOwn(values, value)) throw new Error(`未知预设：${value}`);
  state[id] = value;
  $(id).value = value;
  dirty = true;
}
for (const [id, values] of [['camera', CAMERAS], ['lighting', LIGHTS]]) {
  $(id).addEventListener('change', () => setOptic(id, $(id).value, values));
}

function revealStage() {
  if (narrowView.matches) $('viewport').closest('.monitor').scrollIntoView({
    block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth',
  });
}

$('line-form').addEventListener('submit', event => {
  event.preventDefault();
  const action = $('gesture').value;
  try {
    loadScene([{
      speaker: state.liveActor, line: $('line').value, emotion: state.liveEmotion,
      intensity: Number($('intensity').value) / 100, actions: action ? [action] : [],
    }], { autoplay: true, kind: 'improv' });
    notice('live-notice', '');
    revealStage();
  } catch (error) {
    notice('live-notice', error.message);
  }
});
$('script-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    loadScene($('script').value, { autoplay: true, kind: 'script' });
    notice('script-notice', '');
    revealStage();
  } catch (error) {
    notice('script-notice', error.message);
  }
});
for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click', () => setTab(button.dataset.tab));
$('load-demo').addEventListener('click', () => {
  if (state.tab === 'gallery') setTab('live');
  $('script').value = DEMO;
  notice('live-notice', '');
  notice('script-notice', '');
  loadScene(DEMO, { kind: 'demo' });
});
$('play').addEventListener('click', () => play(!state.playing));
$('timeline').addEventListener('input', () => seek(Number($('timeline').value)));
$('voice').addEventListener('click', () => voice.toggle());
$('captions-toggle').addEventListener('click', () => {
  state.captions = !state.captions;
  $('captions-toggle').setAttribute('aria-pressed', state.captions);
  updateTransport();
});
$('fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await $('viewport').requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => { dirty = true; });
function adjacent(direction) {
  const { beat, local } = sampleScene(state.scene, state.time);
  const index = beat.index + (direction < 0 && local > 0.85 ? 0 : direction);
  if (index < 0) seek(0);
  else if (index >= state.scene.beats.length) seek(state.scene.duration);
  else seek(state.scene.beats[index].start);
}
$('previous').addEventListener('click', () => adjacent(-1));
$('next').addEventListener('click', () => adjacent(1));
document.addEventListener('keydown', event => {
  if (state.portrait || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('textarea, input, button, select, a, [contenteditable]')) return;
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    play(!state.playing);
  } else if (event.key === '[' || event.key === ']') {
    event.preventDefault();
    play(false);
    seek(state.time + (event.key === '[' ? -FRAME_STEP : FRAME_STEP));
  }
});
window.addEventListener('resize', () => { dirty = true; });
document.addEventListener('visibilitychange', () => { lastFrame = 0; });

function tick(now) {
  const delta = lastFrame ? clamp((now - lastFrame) / 1000, 0, 1) : 0;
  lastFrame = now;
  if (state.playing) {
    const adjustment = clamp(correction * delta * 2.6, -delta * 0.42, delta * 0.70);
    correction -= adjustment;
    state.time = Math.min(state.scene.duration, state.time + delta + adjustment);
    const { beat, local } = sampleScene(state.scene, state.time);
    if (voice.current && voice.current.beat !== beat) voice.stop();
    voice.start(beat, local);
    if (state.time >= state.scene.duration) play(false);
    dirty = true;
  }
  if (dirty || stage?.resizeDirty) render();
  requestAnimationFrame(tick);
}

rebuildTimeline();
updateTransport();
updateVoiceButton();
render();

window.actorStudio = Object.freeze({
  ready: Boolean(stage),
  loadScene,
  play,
  pause: () => play(false),
  seek: time => seek(time, true),
  setCamera: mode => { setOptic('camera', mode, CAMERAS); render(); },
  setLighting: mode => { setOptic('lighting', mode, LIGHTS); render(); },
  showPortrait: (emotion, intensity = 1, actor = CAST[0], time) => {
    if (!Object.hasOwn(EMOTIONS, emotion) || !CAST.includes(actor)) throw new Error('未知演员或情绪');
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new RangeError('强度必须在 0 到 1 之间');
    state.portraitActor = actor;
    state.portraitEmotion = emotion;
    $('gallery-intensity').value = intensity * 100;
    setRange('gallery-intensity', 'gallery-strength');
    refreshPortraitActor();
    refreshPortraitEmotion();
    setTab('gallery');
    if (time !== undefined) setPortrait(time);
    render();
  },
  closePortrait: () => { setTab('live'); render(); },
  getState: () => {
    const portrait = state.portrait;
    const time = portrait?.time ?? state.time;
    const scene = portrait?.scene ?? state.scene;
    const { beat, speech } = sampleScene(scene, time);
    return {
      time, duration: scene.duration, beatIndex: beat.index, speaker: beat.speaker,
      line: beat.line, emotion: beat.emotion, actions: [...beat.actions], cast: [...scene.cast],
      playing: state.playing, camera: lastShot, lighting: state.lighting,
      subtitleIndex: portrait ? -1 : speech.index, viseme: portrait ? 'rest' : speech.viseme,
      source: portrait ? 'portrait' : state.source, voice: voice.enabled,
      drawCalls: stage?.renderer.info.render.calls ?? 0,
      triangles: stage?.renderer.info.render.triangles ?? 0,
      renderRatio: stage?.renderer.getPixelRatio() ?? 0,
    };
  },
});
requestAnimationFrame(tick);
