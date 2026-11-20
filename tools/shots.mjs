import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { compileScene, DEMO } from '../src/performance.js';

const require = createRequire(import.meta.url);
const playwrightRoot = process.env.PLAYWRIGHT_ROOT ?? '/workspace/pwtool/node_modules/playwright';
const { chromium } = require(playwrightRoot);
const url = process.env.ACTOR_URL ?? 'http://127.0.0.1:5714/';
const out = resolve(process.argv[2] ?? '/workspace/codex-actor-shots');
const prefix = process.env.ACTOR_SHOT_PREFIX ?? 'r3-';
const viewport = { width: 1440, height: 1040 };
const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const emotions = ['neutral', 'joy', 'sorrow', 'anger', 'fear', 'surprise', 'disgust', 'tender', 'contempt'];
const sequence = [0.11, 0.39, 1.13, 1.22, 2.61, 3.02, 4.42, 5.98];
const demo = compileScene(DEMO);
const errors = [];
let screenshots = 0;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args });
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  monitor(page);
  await open(page);
  const read = () => page.evaluate(() => window.actorStudio.getState());
  const stage = page.locator('#viewport');

  const first = await read();
  assert.equal(first.source, 'demo');
  assert.equal(first.camera, 'wide');
  assert.equal(first.voice, false);
  assert.deepEqual(first.cast, ['罗密欧', '朱丽叶']);
  await shot(page, 'controls');
  await page.evaluate(() => { window.actorStudio.setCamera('wide'); window.actorStudio.seek(1.25); });
  await shot(stage, 'stage-wide');
  const captions = page.getByRole('button', { name: '字幕', exact: true });
  const canvasBounds = await page.locator('#stage').boundingBox();
  await captions.click();
  assert.equal(await page.locator('#caption').isVisible(), false);
  assert.deepEqual(await page.locator('#stage').boundingBox(), canvasBounds);
  await captions.click();
  assert.equal(await page.locator('#caption').isVisible(), true);
  await captions.evaluate(button => button.blur());
  await page.keyboard.press('BracketRight');
  await page.waitForFunction(() => window.actorStudio.getState().time > 1.25);
  assert.ok(Math.abs((await read()).time - 1.25 - 1 / 24) < 0.001);
  await page.keyboard.press('BracketLeft');
  await page.waitForFunction(() => window.actorStudio.getState().time <= 1.25);

  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => window.actorStudio.getState().time > 1.47);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = await read();
  await page.waitForTimeout(220);
  assert.equal((await read()).time, paused.time);
  await page.getByRole('button', { name: '下一句', exact: true }).click();
  assert.equal((await read()).speaker, '朱丽叶');
  await page.getByRole('button', { name: '上一句', exact: true }).click();
  assert.equal((await read()).beatIndex, 0);

  const slider = page.getByRole('slider', { name: '拖动场景时间线' });
  const track = await slider.boundingBox();
  await page.evaluate(() => window.actorStudio.play());
  await page.mouse.move(track.x + track.width * 0.37, track.y + track.height * 0.5);
  await page.mouse.down();
  assert.equal((await read()).playing, false);
  await page.mouse.move(track.x + track.width * 0.46, track.y + track.height * 0.5);
  assert.ok((await read()).time > 16);
  await page.mouse.up();
  assert.equal((await read()).playing, true);
  await page.evaluate(() => window.actorStudio.pause());

  await page.getByRole('button', { name: '全屏舞台', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'monitor');
  assert.equal(await slider.isVisible(), true);
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await page.waitForFunction(() => !document.fullscreenElement);

  await slider.focus();
  await slider.press('End');
  await page.waitForFunction(() => window.actorStudio.getState().beatIndex === 7);
  assert.equal((await read()).playing, false);
  await page.evaluate(() => {
    const director = window.actorStudio;
    director.seek(director.getState().duration - 0.7);
    director.play();
  });
  await page.waitForFunction(() => {
    const state = window.actorStudio.getState();
    return !state.playing && state.time === state.duration;
  });
  await slider.press('Home');
  await page.waitForFunction(() => window.actorStudio.getState().time === 0);
  await page.locator('#camera').selectOption('auto');
  for (const [time, expected] of [[0.5, 'wide'], [1.5, 'medium'], [4.0, 'close']]) {
    await page.evaluate(time => window.actorStudio.seek(time), time);
    assert.equal((await read()).camera, expected);
  }

  const kneel = demo.beats.find(beat => beat.actions.includes('kneel'));
  await page.evaluate(time => window.actorStudio.seek(time), kneel.start + kneel.duration * 0.55);
  assert.equal((await read()).camera, 'wide');
  await shot(stage, 'gesture-kneel');
  const cover = demo.beats.find(beat => beat.actions.includes('hands_on_head'));
  await page.evaluate(time => {
    window.actorStudio.setCamera('medium');
    window.actorStudio.seek(time);
  }, cover.start + cover.duration * 0.46);
  await shot(stage, 'gesture-hands');
  await page.evaluate(() => { window.actorStudio.setCamera('auto'); window.actorStudio.seek(4); });

  await page.getByRole('button', { name: '表情图谱', exact: true }).click();
  assert.equal((await read()).source, 'portrait');
  for (const emotion of emotions) {
    await page.locator(`#gallery-emotions [data-value="${emotion}"]`).click();
    assert.equal((await read()).emotion, emotion);
    await shot(stage, `emotion-${emotion}`);
  }
  await page.evaluate(() => window.actorStudio.showPortrait('tender', 0.9, '朱丽叶'));
  await shot(stage, 'portrait-juliet');
  await page.getByRole('button', { name: '排练台', exact: true }).click();
  assert.equal((await read()).time, 4);

  await page.locator('#camera').selectOption('medium');
  const visemes = new Set();
  const frames = [];
  for (const [index, time] of sequence.entries()) {
    await page.evaluate(time => window.actorStudio.seek(time), time);
    const frame = await read();
    assert.equal(frame.beatIndex, 0);
    assert.equal(frame.camera, 'medium');
    visemes.add(frame.viseme);
    const unit = demo.beats[0].units[frame.subtitleIndex];
    assert.equal(await page.locator('#caption-text mark').textContent(), unit && !unit.punctuation ? unit.char : '');
    frames.push({ t: time, viseme: frame.viseme, subtitleIndex: frame.subtitleIndex });
    await shot(stage, `line-${String(index + 1).padStart(2, '0')}`);
  }
  assert.ok(visemes.size >= 5, 'sequence should show at least five distinct viseme states');
  const study = '你看见那边的光了吗？';
  for (const [label, emotion] of [['hope', 'tender 0.66 + joy 0.29'], ['dread', 'fear 0.68 + sorrow 0.26']]) {
    await page.evaluate(script => {
      const director = window.actorStudio;
      director.loadScene(script);
      director.setCamera('close');
      director.setLighting('moon');
      director.seek(1.46);
    }, `罗密欧 [${emotion} | reach]: ${study}`);
    await shot(stage, `blend-${label}`);
  }
  await page.locator('#camera').selectOption('medium');

  await page.locator('#actor-options [data-value="朱丽叶"]').click();
  await page.locator('#emotions [data-value="surprise"]').click();
  await page.locator('#intensity').fill('87');
  await page.locator('#gesture').selectOption('point');
  await page.locator('#line').fill('看，那边有光！');
  await page.getByRole('button', { name: '开始表演' }).click();
  const custom = await read();
  assert.equal(custom.source, 'improv');
  assert.equal(custom.speaker, '朱丽叶');
  assert.equal(custom.emotion, 'surprise');
  assert.deepEqual(custom.actions, ['point']);
  await page.locator('#lighting').selectOption('rose');
  assert.equal((await read()).lighting, 'rose');

  await page.getByRole('button', { name: '剧本', exact: true }).click();
  await page.locator('#script').fill('朱丽叶 [tender 2]: 停。');
  await page.getByRole('button', { name: '排演剧本' }).click();
  await page.getByText('第 1 行 · 强度必须在 0 到 1 之间', { exact: true }).waitFor();
  await page.locator('#script').fill('罗密欧 [surprise 0.8 + sorrow 0.2 | reach, nod]: 你听见了吗？\n朱丽叶 [tender | turn_away]: 我听见了。');
  await page.getByRole('button', { name: '排演剧本' }).click();
  assert.equal((await read()).source, 'script');
  assert.deepEqual((await read()).actions, ['reach', 'nod']);

  await page.locator('#script-example').selectOption('hamlet');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '排演剧本' }).click();
  await page.getByRole('heading', { name: '哈姆雷特', exact: true }).waitFor();
  assert.deepEqual((await read()).cast, ['哈姆雷特', '奥菲利娅']);
  await page.evaluate(() => {
    window.actorStudio.pause();
    window.actorStudio.setLighting('cold');
    window.actorStudio.setCamera('medium');
  });
  await page.locator('#line-list li:nth-child(3) button').click();
  await page.evaluate(() => {
    const director = window.actorStudio;
    director.seek(director.getState().time + 1.34);
  });
  assert.equal((await read()).speaker, '奥菲利娅');
  await shot(page, 'script-hamlet');

  await page.getByRole('button', { name: '载入示例' }).click();
  await page.getByRole('button', { name: '排练台', exact: true }).click();
  const fps = await page.evaluate(async () => {
    const director = window.actorStudio;
    director.setCamera('wide');
    director.setLighting('auto');
    director.seek(0);
    director.play();
    const duration = 5000;
    const measurement = await new Promise(resolve => {
      let start, frames = 0;
      const count = time => {
        start ??= time;
        const ms = time - start;
        if (ms >= duration) resolve({ frames, ms });
        else {
          frames++;
          requestAnimationFrame(count);
        }
      };
      requestAnimationFrame(count);
    });
    const state = director.getState();
    director.pause();
    return { ...measurement, fps: measurement.frames * 1000 / measurement.ms, drawCalls: state.drawCalls, triangles: state.triangles, renderRatio: state.renderRatio, sceneTime: state.time };
  });
  assert.ok(fps.sceneTime > 3, 'scene advanced while the wide shot was rendering');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  monitor(mobile);
  await open(mobile);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  const mobileFrame = await mobile.locator('#viewport').boundingBox();
  assert.ok(mobileFrame.x + mobileFrame.width <= 390);
  await shot(mobile, 'mobile', { fullPage: true });

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ url, viewport, fps, frames, screenshots }, null, 2));
} finally {
  await browser.close();
}

function monitor(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(request.url() + ' ' + request.failure()?.errorText);
  });
}

async function open(page) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `Stage URL returned ${response?.status() ?? 'no response'}`);
  await page.waitForFunction(() => window.actorStudio?.ready);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(target, name, options = {}) {
  await target.screenshot({ path: join(out, prefix + name + '.png'), animations: 'disabled', ...options });
  screenshots++;
}
