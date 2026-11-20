# Actor Studio · 舞台表演实验室

在浏览器里排练《罗密欧与朱丽叶》的月下花园一场。两位 3D 演员有各自的服装、发型、表情和身体姿态。中文台词以拼音驱动口型，字幕随同一条时间线逐字高亮。场景默认静音，可以直接排练。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:5714/`。生产构建使用 `npm run build`，输出到 `dist/`。用 `npm run preview` 在 `http://127.0.0.1:5814/` 本地预览构建结果。资源使用相对路径。

## 排练

- 点击播放或按空格键。拖动时间线或点击场景台词回看指定位置。用 `[` / `]` 逐帧检查动作，用字幕按钮显示或隐藏逐字提示。
- 在**排练台**选演员、情绪、强度和动作，然后输入一句台词并点击**开始表演**。
- 在**剧本**填写多行台词。用 `+` 混合情绪，用逗号安排多个动作。
- 在**表情图谱**比较两位演员的九种表情及强度。切回排练台可在原来的时间点继续。
- 自动镜头会交替使用全景、中景和特写。也可以锁定机位，或把情绪灯光切成月光、暖金、绯红、冷蓝。
- 点击扬声器可选用设备上的本地中文朗读。语音可用性因浏览器和系统而异。

## 验证与资料

```sh
npm test
node tools/shots.mjs
ACTOR_URL=http://127.0.0.1:5814/ node tools/shots.mjs /workspace/codex-actor-shots
```

截图脚本需要已运行的舞台和 Chromium。默认从 `/workspace/pwtool/node_modules/playwright` 加载 Playwright，可用 `PLAYWRIGHT_ROOT` 覆盖。默认保存为 `/workspace/codex-actor-shots/r2-*.png`，可通过命令行参数更改目录，通过 `ACTOR_SHOT_PREFIX` 更改前缀。

[表演 API](docs/PERFORMANCE_API.md) · [研究](docs/RESEARCH.md) · [设计](docs/DESIGN.md) · [署名与许可](docs/CREDITS.md) · [迭代记录](docs/ROUNDS.md)

## English

Actor Studio is a browser-based rehearsal space for a Chinese adaptation of the balcony scene from *Romeo and Juliet*. Two procedural 3D performers share a seekable timeline for Mandarin visemes, subtitles, gestures, and listening reactions. Use the live controls to improvise, the script editor to blend emotions, or the expression gallery to compare portraits. Playback is silent by default. Run `npm ci && npm run dev` and open port 5714.
