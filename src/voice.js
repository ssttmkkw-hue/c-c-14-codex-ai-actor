export class MandarinVoice {
  constructor(onBoundary, onStatus) {
    this.synthesis = window.speechSynthesis;
    this.onBoundary = onBoundary;
    this.onStatus = onStatus;
    this.enabled = false;
    this.current = null;
  }

  get voice() {
    const chinese = this.synthesis?.getVoices().filter(voice => voice.localService && /^zh(?:[-_]|$)/i.test(voice.lang));
    return chinese?.find(voice => /^zh[-_](CN|Hans)/i.test(voice.lang)) ?? chinese?.[0];
  }

  start(beat, local) {
    if (!this.enabled || !this.voice || this.current?.beat === beat || local < beat.units[0].start || local >= beat.speechEnd) return;
    this.stop();
    const first = beat.units.find(unit => unit.end > local && !unit.punctuation);
    if (!first) return;
    const utterance = new SpeechSynthesisUtterance(beat.line.slice(first.offset));
    utterance.voice = this.voice;
    utterance.lang = utterance.voice.lang;
    utterance.rate = beat.emotion === 'sorrow' ? 0.92 : beat.emotion === 'anger' ? 1.10 : 1;
    utterance.pitch = beat.speaker === '朱丽叶' ? 1.1 : 0.92;
    const delivery = { beat, utterance };
    this.current = delivery;
    utterance.onboundary = event => {
      if (this.current !== delivery) return;
      const unit = beat.units.find(token => token.offset >= first.offset + event.charIndex);
      if (unit) this.onBoundary(beat, unit.start);
    };
    utterance.onerror = event => {
      if (this.current !== delivery || event.error === 'canceled' || event.error === 'interrupted') return;
      this.enabled = false;
      this.stop();
      this.onStatus('朗读不可用，舞台将继续无声播放。');
    };
    this.synthesis.speak(utterance);
  }

  stop() {
    if (!this.current) return;
    this.current = null;
    this.synthesis?.cancel();
  }

  toggle() {
    if (this.enabled) {
      this.enabled = false;
      this.stop();
      this.onStatus('');
    } else if (!this.voice) {
      this.onStatus('当前浏览器没有可用的本地中文语音。');
    } else {
      this.enabled = true;
      this.onStatus('已开启本地中文朗读。');
    }
    return this.enabled;
  }
}
