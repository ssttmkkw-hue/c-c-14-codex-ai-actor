# 表演 API

## 短剧本

每行是一条表演指令。可使用半角或全角冒号分隔角色与台词。空行和以 `#` 开头的行会跳过。

```text
罗密欧 [tender 0.7 | reach, step_forward]: 轻声！那边窗子里亮起来的是什么光？
朱丽叶 [sorrow 0.6 + tender 0.3 | clutch_heart]：我愿把这句话留到天亮。
罗密欧: 晚安。
```

- 方括号可省略，默认情绪为 `neutral`。写了情绪但省略强度时，默认强度是 `0.65`。强度范围为 `0–1`。
- `+` 叠加情绪。每个强度独立计入面部和姿态。总强度超过 1 时等比例归一。首项决定台词节奏和自动灯光的情绪色。
- `|` 后列出动作，使用半角或全角逗号。肢体动作沿台词的相对时间展开，多个手势依次偏移并交叠。演员会根据分句在开口前呼吸、在重音处发力，并在搭档说完后做出反应。
- 场景接受一或两个人名。`罗密欧` 和 `朱丽叶` 各有固定模型。其他名字使用当前空闲的模型位。

| 标签 | 说明 |
| --- | --- |
| `neutral`, `joy`, `sorrow`, `anger`, `fear`, `surprise`, `disgust`, `tender`, `contempt` | 平静、喜悦、悲伤、愤怒、恐惧、惊讶、厌恶、温柔、轻蔑 |
| `point`, `reach`, `clutch_heart`, `hands_on_head`, `turn_away`, `kneel`, `step_forward`, `recoil`, `nod` | 指向、伸手、捂心口、抱头、转身、单膝跪、向前迈步、后缩、点头 |
| `auto`, `wide`, `medium`, `close` | 自动镜头、全景、中景、特写 |
| `auto`, `moon`, `amber`, `rose`, `cold` | 随情绪、月光、暖金、绯红、冷蓝 |

## 浏览器调用

舞台初始化后，`window.actorStudio` 提供控制方法。 `ready` 表示渲染器是否可用。

```js
const director = window.actorStudio;

const duration = director.loadScene([
  {
    speaker: '罗密欧',
    line: '那边窗子里亮起来的是什么光？',
    emotions: [
      { emotion: 'tender', intensity: 0.7 },
      { emotion: 'surprise', intensity: 0.24 },
    ],
    actions: ['reach', 'step_forward'],
  },
  {
    speaker: '朱丽叶',
    line: '夜色太深了。你是谁？',
    emotion: 'fear',
    intensity: 0.8,
    actions: ['recoil'],
  },
]);

director.setCamera('auto');
director.setLighting('moon');
director.play();
director.pause();
director.seek(duration / 3);
console.log(director.getState());

director.showPortrait('contempt', 0.9, '朱丽叶');
director.closePortrait();
```

| 方法 | 行为 |
| --- | --- |
| `loadScene(scriptOrCues, { autoplay = false } = {})` | 接受短剧本文本或对象数组。校验通过后用新场景替换当前场景，返回总秒数。舞台在调用返回时已采样新场景。输入有误时抛出错误，保留当前场景。 |
| `play()`、`pause()` | 从当前位置继续或暂停。场景结束后再次播放会从头开始。 |
| `seek(seconds)` | 将合法数值限制在场景范围内，立即更新舞台，返回定位后的秒数。暂停状态保持暂停。 |
| `setCamera(mode)`、`setLighting(preset)` | 设置机位或灯光预设。 |
| `showPortrait(emotion, intensity = 1, actor = '罗密欧', time?)` | 预览表情。可传入采样秒数以复现眨眼或扫视。会暂停场景。 |
| `closePortrait()` | 返回当前场景和之前的播放位置。 |
| `getState()` | 读取时间、总时长、台词序号、说话者、台词、情绪、动作、镜头、灯光、口型、字幕索引和播放状态。序号与索引均从 0 起算。开口前字幕索引为 `-1`，说完后等于台词字符数量。 |

## 复用时间线编译器

`src/performance.js` 是不依赖 DOM 的 ES 模块。 `parseScript(text)` 返回检查过的台词对象。 `compileScene(textOrCues)` 建立场景总时长及各拍的相对时间。 `sampleScene(scene, seconds)` 给出对应的拍、相对时间、进度和口型。每拍的 `units` 包含原始字符、在台词里的 UTF-16 偏移、起止秒数、拼音与发音阶段。

`sampleSpeech(beat, secondsInBeat)` 提供下颌开度、唇部横展、圆唇、闭唇和露齿五个通道。静音口型与字幕共用模型时钟。选择本地中文语音后，浏览器若提供朗读边界事件，时间线会逐步校正。语音引擎的读音、边界事件和时长会影响匹配精度。拉丁字母和数字以通用说话形状处理。

排练台把较长的台词按标点和长度分段显示，当前发音的字符会高亮。完整台词仍可在时间线下方查看。点按字幕按钮可隐藏字幕栏，舞台画面尺寸保持一致。在编辑框外按 `[` 或 `]` 会暂停并按每步 1/24 秒前后移动，便于比较闭唇、停顿和手势接触。控件外的空格键切换播放和暂停。按下时间线滑块会暂时停住演出，松开时恢复拖动前的播放状态。全屏保留字幕和播放条。

普通话音节的交界共用一个插值端点。双唇音会在交界保留闭唇目标，标点留出口型静止的停顿。拼音词典会根据上下文选音，编译器另外校对了少量常见搭配，如「得走」和「着火」。分段字幕沿用整句的字符索引。浏览器朗读使用系统音色的读音。

舞台与表演时间线分别由 `Stage` 和 `compileScene` 实现。接入另一套角色造型时，可在 `Stage.render` 复用混合的表情、口型、动作标签、分句重音和倾听强度输入，为新模型实现相应的 `pose`。音频录制与外部音素时间码目前没有导入接口。
