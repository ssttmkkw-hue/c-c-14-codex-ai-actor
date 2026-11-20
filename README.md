# Actor Studio · 舞台表演实验室

在浏览器里排练《罗密欧与朱丽叶》的阳台一场，或在剧本面板试演《哈姆雷特》。两位 3D 演员用眉眼、口型、姿态和手势说台词与接戏。拼音口型和逐字高亮共用时间线，默认静音。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:5714/`。生产构建使用 `npm run build`，输出到 `dist/`。用 `npm run preview` 在 `http://127.0.0.1:5814/` 本地预览构建结果。资源使用相对路径。

## 排练

- 点击播放或在控件外按空格键。拖动时间线时暂停，松开后从选定位置继续原本在播放的场景。点击场景台词可跳到对应句。用 `[` / `]` 逐帧检查。字幕和播放控制在全屏中也可操作。
- 在**排练台**选演员、情绪、强度和动作，然后输入一句台词并点击**开始表演**。
- 在**剧本**填写多行台词，或选择《哈姆雷特》并点击**填入**和**排演剧本**。用 `+` 混合情绪，用逗号安排多个动作。
- 在**表情图谱**比较两位演员的九种表情及强度。切回排练台可在原来的时间点继续。
- 自动镜头会交替使用全景、中景和特写。也可以锁定机位，或把情绪灯光切成月光、暖金、绯红、冷蓝。
- 点击扬声器可选用设备上的本地中文朗读。语音可用性因浏览器和系统而异。

## 表演 API

一行脚本指定角色、台词、情绪与动作。强度在 0 到 1 之间，可同时使用两个角色。

```text
罗密欧 [tender 0.7 + joy 0.2 | reach, step_forward]: 轻声！那边窗子里亮起来的是什么光？
朱丽叶 [sorrow 0.6 | clutch_heart]: 啊，罗密欧，你为什么偏偏是罗密欧？
```

浏览器可用 `window.actorStudio.loadScene(scriptOrCues)` 载入短剧本或台词对象数组，再调用 `play()`、`pause()`、`seek(seconds)`、`setCamera(mode)` 和 `setLighting(preset)`。脚本语法、动作标签、表情预览与无 DOM 时间线编译器的用法见 [表演 API](docs/PERFORMANCE_API.md)。

## 已知限制

- 口型、台词重音和倾听反应根据文本估时。可选的中文朗读依赖设备提供的本地音色，实际同步精度取决于语音引擎提供的边界事件。
- 两段剧本共用同一舞台和两个角色模型。手和栏杆、衣领与头部、下跪时的接触均为程序近似。部分极端姿势会穿模。
- 需要支持 WebGL 2 的浏览器。检测到 SwiftShader 等软件渲染时，播放会降低分辨率以保留动作响应。已测软件渲染，实际硬件 GPU 帧率因设备而异。

## 验证与资料

```sh
npm test
node tools/shots.mjs
ACTOR_URL=http://127.0.0.1:5814/ node tools/shots.mjs /workspace/codex-actor-shots
```

截图脚本需要已运行的舞台和 Chromium。默认从 `/workspace/pwtool/node_modules/playwright` 加载 Playwright，可用 `PLAYWRIGHT_ROOT` 覆盖。默认保存为 `/workspace/codex-actor-shots/r3-*.png`，可通过命令行参数更改目录，通过 `ACTOR_SHOT_PREFIX` 更改前缀。

[表演 API](docs/PERFORMANCE_API.md) · [研究](docs/RESEARCH.md) · [设计](docs/DESIGN.md) · [署名与许可](docs/CREDITS.md) · [迭代记录](docs/ROUNDS.md)

## English

Actor Studio is a browser rehearsal space with original Chinese renderings of excerpts from *Romeo and Juliet* and *Hamlet*. The two 3D performers share a seekable timeline for Mandarin visemes, subtitles, gestures, and listening reactions. Use the director controls to improvise, the script panel to blend emotions, or the expression gallery to compare portraits. Playback is silent by default. Run `npm ci && npm run dev` and open port 5714. The browser API accepts either short scripts or structured cues. [Performance API](docs/PERFORMANCE_API.md)
