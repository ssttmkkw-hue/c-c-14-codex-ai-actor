import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScene, DEMO, MOUTH, parseScript, sampleScene, sampleSpeech } from '../src/performance.js';
import { blendedExpression } from '../src/actor.js';

test('short script grammar preserves Chinese colons in a line and combines direction tags', () => {
  const [beat] = parseScript('# 排练\n朱丽叶 [tender 0.7 + sorrow 0.3 | reach，clutch_heart, reach]：听我说：别走。');
  assert.equal(beat.line, '听我说：别走。');
  assert.deepEqual(beat.emotions, [{ emotion: 'tender', intensity: 0.7 }, { emotion: 'sorrow', intensity: 0.3 }]);
  assert.deepEqual(beat.actions, ['reach', 'clutch_heart']);
  assert.throws(() => parseScript('# 预备\n罗密欧 [tender 1.2]: 台词'), /第 2 行.*强度/);
  assert.throws(() => parseScript('罗密欧 [tender 0 | typo]: 台词'), /未知动作/);
});

test('Mandarin bilabial closures, vowels and punctuation share the subtitle index', () => {
  const { beats: [beat] } = compileScene('朱丽叶: 妈，闭上窗。');
  const [ma, comma, bi] = beat.units;
  assert.equal(ma.pinyin, 'ma');
  assert.equal(ma.onset, 'closed');
  assert.equal(ma.vowel, 'open');
  assert.equal(comma.punctuation, true);
  assert.equal(bi.onset, 'closed');
  assert.equal(bi.vowel, 'spread');
  const at = (unit, phase) => unit.start + phase * (unit.end - unit.start);
  assert.deepEqual(sampleSpeech(beat, 0).mouth, MOUTH.rest);
  assert.equal(sampleSpeech(beat, at(ma, 0.09)).mouth[3], 1);
  assert.equal(sampleSpeech(beat, at(ma, 0.65)).index, 0);
  assert.equal(sampleSpeech(beat, at(ma, 0.65)).viseme, 'open');
  assert.equal(sampleSpeech(beat, at(comma, 0.55)).talking, false);
  assert.equal(sampleSpeech(beat, at(bi, 0.68)).index, 2);
  assert.equal(sampleSpeech(beat, at(bi, 0.68)).viseme, 'spread');
  assert.deepEqual(sampleSpeech(beat, beat.speechEnd).mouth, MOUTH.rest);
});

test('compiled seeks are repeatable and established roles retain their rig when solo or reordered', () => {
  const juliet = compileScene('朱丽叶: 听，月色正明。');
  assert.deepEqual(juliet.slots, [null, '朱丽叶']);
  const duo = compileScene('朱丽叶: 喂。\n罗密欧: 是我。');
  assert.deepEqual(duo.slots, ['罗密欧', '朱丽叶']);
  assert.throws(() => compileScene('甲: 我。\n乙: 你。\n丙: 他。'), /两位/);
  const scene = compileScene(DEMO);
  const first = sampleScene(scene, 2.72);
  assert.equal(sampleScene(scene, scene.beats[1].start).beat.index, 1);
  assert.equal(sampleScene(scene, scene.duration + 1).beat.index, scene.beats.length - 1);
  assert.deepEqual(sampleScene(scene, 2.72), first);
});

test('emotion intensity zero rests and positive weights blend without overshooting', () => {
  const joy = blendedExpression([{ emotion: 'joy', intensity: 1 }]);
  const sorrow = blendedExpression([{ emotion: 'sorrow', intensity: 1 }]);
  const both = blendedExpression([{ emotion: 'joy', intensity: 0.9 }, { emotion: 'sorrow', intensity: 0.9 }]);
  assert.equal(both.smile, (joy.smile + sorrow.smile) / 2);
  assert.equal(both.frown, (joy.frown + sorrow.frown) / 2);
  assert.equal(blendedExpression([{ emotion: 'fear', intensity: 0 }]).eye, 0);
});


test('adjacent Mandarin mouth poses meet at syllable and punctuation boundaries', () => {
  const { beats: [beat] } = compileScene('罗密欧: 看，妈！房里一行字着火了。');
  assert.equal(beat.units.find(unit => unit.char === '着').pinyin, 'zhao');
  assert.equal(beat.units.find(unit => unit.char === '行').pinyin, 'hang');
  for (const unit of beat.units.filter(unit => !unit.punctuation)) {
    for (const t of [unit.start, unit.end]) {
      const before = sampleSpeech(beat, t - 1e-7).mouth;
      const after = sampleSpeech(beat, t).mouth;
      before.forEach((value, channel) => assert.ok(Math.abs(value - after[channel]) < 0.001));
    }
  }
  const { beats: [rounded] } = compileScene('朱丽叶: 月下钟声。');
  assert.equal(rounded.units[0].onset, 'pucker');
  assert.equal(rounded.units[2].vowel, 'round');
});
