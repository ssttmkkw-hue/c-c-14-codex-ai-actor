import { pinyin } from 'pinyin-pro';

export const EMOTIONS = {
  neutral: '平静', joy: '喜悦', sorrow: '悲伤', anger: '愤怒', fear: '恐惧',
  surprise: '惊讶', disgust: '厌恶', tender: '温柔', contempt: '轻蔑',
};
export const ACTIONS = {
  point: '指向', reach: '伸手', clutch_heart: '捂住心口', hands_on_head: '双手抱头',
  turn_away: '转身', kneel: '单膝跪下', step_forward: '向前一步', recoil: '后缩', nod: '点头',
};
const aliases = { tenderness: 'tender', happy: 'joy', sadness: 'sorrow', sad: 'sorrow', angry: 'anger', fearful: 'fear' };
export const CAST = ['罗密欧', '朱丽叶'];

export const DEMO = `罗密欧 [tender 0.72 | reach, step_forward]: 轻声！那边窗子里亮起来的是什么光？是东方，朱丽叶就是太阳。
朱丽叶 [sorrow 0.73 | clutch_heart]: 啊，罗密欧，罗密欧！你为什么偏偏是罗密欧？舍去你的姓，忘了你的父亲吧。
朱丽叶 [tender 0.86 + fear 0.23 | reach]: 要是你不肯，只要发誓爱我，我便不再做凯普莱特家的人。
罗密欧 [surprise 0.67 | recoil]: 我还该听下去，还是现在就回答她？
朱丽叶 [contempt 0.52 + sorrow 0.35 | point, turn_away]: 与我为敌的只有你的名字。玫瑰换一个名字，还是一样芬芳。
罗密欧 [joy 0.78 + tender 0.44 | clutch_heart, kneel]: 那就只叫我爱人吧。我愿重新受洗，从此再也不叫罗密欧。
朱丽叶 [fear 0.84 | hands_on_head]: 谁在黑夜里偷听我说话？
罗密欧 [tender 0.9 | reach]: 我的名字是你的仇敌。倘若写在纸上，我定把它撕掉。`;

export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export const mix = (a, b, weight) => a + (b - a) * weight;
export function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function checkEmotion(name) {
  const key = aliases[name] ?? name;
  if (!Object.hasOwn(EMOTIONS, key)) throw new Error(`未知情绪：${name}`);
  return key;
}

function weight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('强度必须在 0 到 1 之间');
  }
  return value;
}

export function normalizeCue(cue) {
  const speaker = String(cue.speaker ?? '').trim();
  const line = String(cue.line ?? '').trim();
  if (!speaker) throw new Error('请填写角色名');
  if (!line) throw new Error('请填写台词');
  const emotion = checkEmotion(cue.emotion ?? 'neutral');
  const intensity = weight(cue.intensity ?? 0.65);
  const emotions = (cue.emotions ?? [{ emotion, intensity }]).map(entry => ({
    emotion: checkEmotion(entry.emotion), intensity: weight(entry.intensity),
  }));
  if (!emotions.length) throw new Error('至少需要一种情绪');
  const actions = [...new Set(cue.actions ?? [])];
  for (const action of actions) {
    if (!Object.hasOwn(ACTIONS, action)) throw new Error(`未知动作：${action}`);
  }
  return { speaker, line, emotion: emotions[0].emotion, intensity: emotions[0].intensity, emotions, actions };
}

export function parseScript(script) {
  const cues = [];
  for (const [index, row] of String(script).split(/\r?\n/).entries()) {
    const input = row.trim();
    if (!input || input.startsWith('#')) continue;
    try {
      const parts = input.match(/^([^\[\]:：]+?)\s*(?:\[([^\]]+)\])?\s*[:：]\s*(.+)$/u);
      if (!parts) throw new Error('格式为 角色 [情绪 强度 | 动作]: 台词');
      const [, speaker, directions = 'neutral', line] = parts;
      const [blend, tags, extra] = directions.split('|');
      if (extra !== undefined) throw new Error('每条台词的舞台指令只使用一个 |');
      const emotions = blend.split('+').map(entry => {
        const [name, amount, unexpected] = entry.trim().split(/\s+/u);
        if (unexpected !== undefined) throw new Error('每个情绪只能带一个强度');
        return { emotion: name, intensity: amount === undefined ? 0.65 : Number(amount) };
      });
      const actions = tags ? tags.split(/[,，]/u).map(action => action.trim()).filter(Boolean) : [];
      cues.push(normalizeCue({ speaker, line, emotions, actions }));
    } catch (error) {
      throw new Error(`第 ${index + 1} 行 · ${error.message}`);
    }
  }
  if (!cues.length) throw new Error('剧本里没有台词');
  return cues;
}

// Jaw aperture, lip spread, protrusion, bilabial seal, upper teeth.
export const MOUTH = {
  rest: [0, 0, 0, 0, 0], open: [0.92, 0.11, 0, 0, 0.21], mid: [0.55, 0.02, 0.12, 0, 0.31],
  spread: [0.27, 0.72, 0, 0, 0.72], round: [0.51, -0.14, 0.80, 0, 0.14],
  pucker: [0.25, -0.39, 0.93, 0, 0.04], closed: [0, 0.07, 0.06, 1, 0],
  teeth: [0.14, 0.25, 0, 0, 0.91], tongue: [0.28, 0.25, 0.05, 0, 0.54],
  hush: [0.20, 0.10, 0.43, 0, 0.45], nasal: [0.18, 0.11, 0.08, 0, 0.21],
};

function sound(unit) {
  const initial = unit.initial;
  const final = (unit.final || unit.pinyin).replaceAll('v', 'ü');
  if (!final) return { onset: 'nasal', vowel: 'mid', coda: 'rest' };
  let vowel = 'mid';
  if (/a/u.test(final)) vowel = 'open';
  else if (/^[üu]$/u.test(final)) vowel = 'pucker';
  else if (final === 'iu' || final === 'iou') vowel = 'round';
  else if (/^[ou]|[ou]$/u.test(final) && !/^i/u.test(final)) vowel = 'round';
  else if (/^[iê]/u.test(final) && !/^[zcsr]h?$/u.test(initial)) vowel = 'spread';
  if (/^[jqx]$/.test(initial) && /^u/u.test(final)) vowel = final === 'u' ? 'pucker' : 'round';
  let onset = vowel;
  if (/^[bmp]$/u.test(initial)) onset = 'closed';
  else if (initial === 'f' || /^[zcs]$/u.test(initial)) onset = 'teeth';
  else if (/^(?:zh|ch|sh|r)$/u.test(initial)) onset = 'hush';
  else if (/^[dtln]$/u.test(initial)) onset = 'tongue';
  else if (initial === 'w' || (/^[üu]/u.test(final) && final.length > 1)) onset = 'pucker';
  else if (initial === 'y' && vowel !== 'pucker') onset = 'spread';
  else if (/^i/u.test(final) && final.length > 1) onset = 'spread';
  let coda = vowel;
  if (/n[g]?$/u.test(final)) coda = 'nasal';
  else if (/u$/u.test(final) && vowel === 'round') coda = 'pucker';
  else if (/[ou]$/u.test(final) && vowel === 'open') coda = 'round';
  else if (final === 'ui' || final === 'uei') coda = 'spread';
  else if (/i$/u.test(final) && vowel === 'open') coda = 'spread';
  return { onset, vowel, coda };
}

const LEAD = 0.29;

export function compileScene(source) {
  const cues = typeof source === 'string' ? parseScript(source) : source.map(normalizeCue);
  if (!cues.length) throw new Error('剧本里没有台词');
  const cast = [...new Set(cues.map(cue => cue.speaker))];
  if (cast.length > 2) throw new Error('舞台最多安排两位演员');
  let time = 0;
  const beats = cues.map((cue, index) => {
    let elapsed = LEAD;
    let offset = 0;
    let soundIndex = 0;
    const pace = cue.emotion === 'sorrow' ? 1.12 : cue.emotion === 'anger' ? 0.88 : 1;
    const units = pinyin(cue.line, { toneType: 'none', type: 'all' }).map(unit => {
      const punctuation = !unit.isZh && !/[\p{L}\p{N}]/u.test(unit.origin);
      const gap = /[。！？!?.…]/u.test(unit.origin) ? 0.40 : /[，、；：,;:—]/u.test(unit.origin) ? 0.26 : 0.085;
      const hold = punctuation ? gap : (0.155 + (soundIndex++ % 5 === 2 ? 0.047 : 0)) * pace;
      const token = { char: unit.origin, offset, start: elapsed, end: elapsed + hold, pinyin: unit.pinyin, ...sound(unit), punctuation };
      offset += unit.origin.length;
      elapsed += hold;
      return token;
    });
    const beat = { ...cue, index, start: time, speechEnd: elapsed, duration: elapsed + 0.48, units };
    time += beat.duration;
    return beat;
  });
  const slots = CAST.map(name => cast.includes(name) ? name : null);
  for (const name of cast) {
    if (!slots.includes(name)) slots[slots.indexOf(null)] = name;
  }
  return { beats, cast, slots, duration: time };
}

function shapeBetween(a, b, factor) {
  return a.map((value, index) => mix(value, b[index], factor));
}

export function sampleSpeech(beat, local) {
  const { units } = beat;
  const index = units.findIndex(unit => local < unit.end);
  if (local < LEAD - 0.055) return { mouth: MOUTH.rest, index: -1, viseme: 'rest', talking: false };
  if (index < 0) return { mouth: MOUTH.rest, index: units.length, viseme: 'rest', talking: false };
  const unit = units[index];
  const previous = units[index - 1];
  const next = units[index + 1];
  const phase = clamp((local - unit.start) / (unit.end - unit.start));
  if (unit.punctuation) {
    const mouth = !previous || previous.punctuation ? MOUTH.rest : shapeBetween(MOUTH[previous.coda], MOUTH.rest, ease(phase * 4));
    return { mouth, index, viseme: 'rest', talking: false };
  }
  let mouth;
  if (phase < 0.24) {
    const carry = previous && !previous.punctuation && unit.onset !== 'closed' ? 0.35 : 0;
    const entry = shapeBetween(MOUTH[unit.onset], MOUTH[previous?.coda ?? 'rest'], carry);
    mouth = shapeBetween(entry, MOUTH[unit.onset], ease(phase / 0.24));
  } else if (phase < 0.55) {
    mouth = shapeBetween(MOUTH[unit.onset], MOUTH[unit.vowel], ease((phase - 0.24) / 0.31));
  } else {
    mouth = shapeBetween(MOUTH[unit.vowel], MOUTH[unit.coda], ease((phase - 0.55) / 0.34));
    if (next && !next.punctuation && phase > 0.83) {
      mouth = shapeBetween(mouth, MOUTH[next.onset], ease((phase - 0.83) / 0.17) * 0.48);
    }
  }
  return { mouth, index, viseme: phase < 0.30 ? unit.onset : phase > 0.82 ? unit.coda : unit.vowel, talking: local >= LEAD };
}

export function sampleScene(scene, time) {
  const position = clamp(time, 0, scene.duration);
  const index = scene.beats.findIndex(beat => position < beat.start + beat.duration);
  const beat = scene.beats[index === -1 ? scene.beats.length - 1 : index];
  const local = position - beat.start;
  return { beat, local, progress: clamp(local / beat.duration), speech: sampleSpeech(beat, local) };
}
