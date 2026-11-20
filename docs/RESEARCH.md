# 第一轮研究 · 浏览器舞台表演

## kk 的三个剧场项目

在本地阅读了这三个项目的源码。它们解决了剧本输入、即兴调度和舞台组织。本项目沿用「一拍是一项表演指令」的概念，把精度提高到单字和单个身体动作。

| 项目 | 源码观察 | 对本轮的启发 |
| --- | --- | --- |
| c-c-5-ai-theater | 表演 schema 归一化人物、情绪、动作和站位。程序化面部的眉眼和口部可以独立驱动。电影镜头随拍点轮换，在远景与角色近景之间缓动。 [表演 schema](https://github.com/ssttmkkw-hue/c-c-5-ai-theater/blob/main/src/performance/schema.js) · [面部](https://github.com/ssttmkkw-hue/c-c-5-ai-theater/blob/main/src/actors/styles/face.js) · [摄影机](https://github.com/ssttmkkw-hue/c-c-5-ai-theater/blob/main/src/camera/cameras.js) | 保留精简台词指令。拆出唇缘、眼裂和眉形，以特写为验收尺度。镜头选择看当拍的情绪强度和表演动作。 |
| c-c-6-live-theater | 导演可用语音边界事件或按标点加权的字幕时钟。角色把姿势、手势、说话律动、眉眼、眨眼和注意方向叠加。 [导演](https://github.com/ssttmkkw-hue/c-c-6-live-theater/blob/main/src/director.js) · [角色](https://github.com/ssttmkkw-hue/c-c-6-live-theater/blob/main/src/theater/actor.js) | 保留静音时钟。把口型拆成发音阶段，供字幕与嘴形共用。把眨眼、扫视和反应写成随场景时间采样的动作，方便反复看同一瞬间。 |
| c-c-7-codex-live-theater | 本地解析器逐拍输出台词。舞台预设有追光、主光、补光和轮廓光，也限制渲染像素比。 [解析器](https://github.com/ssttmkkw-hue/c-c-7-codex-live-theater/blob/main/src/parser.js) · [舞台](https://github.com/ssttmkkw-hue/c-c-7-codex-live-theater/blob/main/src/stage.js) | 先编排整段台词，便于暂停和拖动。把追光目标和色彩作为导演的一部分，用软件渲染实测画面成本。 |

## 面部和普通话口型

- **以可见动作构成表情。** Ekman 与 Friesen 的 FACS 将眉、眼睑、脸颊和唇角等可观察的运动拆成动作单元。我们据此分离眉内外端、眼裂、闭眼和嘴角，再组合成可调权重的舞台表情。例如果断提高一侧嘴角，能让轻蔑与双侧微笑形成可见差异。 [FACS 概览](https://www.paulekman.com/facial-action-coding-system/) · [Ekman 与 Friesen 的动作测量论文](https://www.paulekman.com/wp-content/uploads/2013/07/Measuring-Facial-Movement.pdf)
- **发音与表情各有职责。** 微软的普通话发音表提供拼音与可见口型的对应参考。pinyin-pro 在浏览器内离线读出汉字拼音，保留上下文帮助判断多音字。制作时把唇音闭合、张口元音、横向展开和圆唇归入少数可辨姿势，在相邻发音间插值。标点决定停顿，表情层继续影响嘴角、眉眼和身体。 [普通话语音与口型表](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets) · [pinyin-pro 源码](https://github.com/zh-lx/pinyin-pro)
- **配音单独适配。** Web Speech 的合成边界由浏览器与语音引擎提供，规范允许引擎只提供词或句级边界。调试时以本地时钟为基础，给所选语音留下校时空间。录音驱动的音素时间戳适合后续固定台词和精细校准。 [Web Speech API](https://webaudio.github.io/web-speech-api/#speechsynthesis)
- **可形变的 3D 几何。** three.js 的示例展示了如何对同一人脸模型调节多种 morph target 权重。这个机制适合后续导入有形变键的模型。本轮通过程序化几何和独立的表情参数反复调整眼裂、眉形与发音姿态，也方便在同一套控制接口下比较两位演员。 [three.js 面部形变示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_morphtargets_face.html) · [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)

## 身体节奏和舞台调度

- 手势先给准备动作，再到最大的轮廓，最后依次收回手、肩和身体。情绪改变重心，呼吸和扫视维持连续性。听者的点头放在有意义的停顿附近，并给说话者留出视觉上的主次。 [John Lasseter，传统动画原则在三维动画中的应用](https://users.cs.northwestern.edu/~animation/Lasseter_1987.pdf)
- 全景说明演员和布景的关系，中景让观众看清手，特写留给眉眼和口型。局部高光由聚光范围、光源目标和柔边决定，轮廓光给深色服装留出清晰的边缘。 [three.js SpotLight](https://threejs.org/docs/pages/SpotLight.html)
- 剧本取《罗密欧与朱丽叶》第二幕第二场的卡普莱特家果园对话。演示采用据莎士比亚公版原作编写的中文短译。开场关注窗边的光，后段换成对姓名、告白与危险的反应。 [1623 年第一对开本](https://internetshakespeare.uvic.ca/doc/Rom_F1/scene/2.2/index.html) · [Folger 幕场索引](https://www.folger.edu/explore/shakespeares-works/romeo-and-juliet/read/2/2/)
