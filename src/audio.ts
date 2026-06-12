class AmbientSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private chimeTimeout: number | null = null;
  private isPlaying: boolean = false;

  // Eb Major Pentatonic scale (Eb4, F4, G4, Bb4, C5, Eb5, F5, G5, Bb5)
  private scale = [311.13, 349.23, 392.00, 466.16, 523.25, 622.25, 698.46, 783.99, 932.33];

  constructor() {}

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public start() {
    if (this.isPlaying) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;

    // Fade in master volume
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 3.0); // Soft, non-intrusive volume

    this.startDrone();
    this.scheduleNextChime();
  }

  public stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.ctx && this.masterGain) {
      // Fade out master volume
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
    }

    // Stop oscillators and clear timers after fade out
    setTimeout(() => {
      if (!this.isPlaying) {
        this.stopDrone();
        if (this.chimeTimeout) {
          clearTimeout(this.chimeTimeout);
          this.chimeTimeout = null;
        }
      }
    }, 1600);
  }

  private startDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Very low volume for the background drone
    this.droneGain.connect(this.masterGain);

    // Create a rich ambient pad with 3 oscillators tuned to a chord (Eb3, Bb3, G4)
    const frequencies = [155.56, 233.08, 392.00];
    this.oscillators = frequencies.map((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();
      
      // Use triangle waves for a smooth, warm tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);

      // Lowpass filter to shave off high harshness
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400 + index * 100, this.ctx!.currentTime);

      // Connect LFO (Low-Frequency Oscillator) to filter frequency for "shimmering" animation
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.setValueAtTime(0.08 + index * 0.03, this.ctx!.currentTime); // slow wave
      lfoGain.gain.setValueAtTime(50, this.ctx!.currentTime); // sweep filter +-50Hz

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.droneGain!);

      // Modulate oscillator individual volumes slightly to breathe
      oscGain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
      
      osc.start();
      
      // Keep track of elements to clean up later
      this.oscillators.push(lfo);
      return osc;
    });
  }

  private stopDrone() {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.oscillators = [];
  }

  private scheduleNextChime() {
    if (!this.isPlaying) return;

    // Random interval between 3.5 to 7 seconds
    const interval = 3500 + Math.random() * 3500;
    this.chimeTimeout = window.setTimeout(() => {
      this.playChime();
      this.scheduleNextChime();
    }, interval);
  }

  private playChime() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;

    // Pick a random note from Eb Major Pentatonic
    const noteIndex = Math.floor(Math.random() * this.scale.length);
    const freq = this.scale[noteIndex];

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const delay = this.ctx.createDelay();
    const feedback = this.ctx.createGain();

    // Use sine wave for pure bell-like tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    // Chime volume envelope (fast attack, long decay)
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.04, this.ctx.currentTime + 0.1); // soft touch
    // Exponential decay to feel natural
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 4.0);

    // Feedback Delay effect for celestial echo
    delay.delayTime.setValueAtTime(0.4, this.ctx.currentTime); // 400ms echo
    feedback.gain.setValueAtTime(0.4, this.ctx.currentTime); // feedback volume

    // Route connections
    // Direct path: osc -> gain -> master
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Echo path: gain -> delay -> feedback -> delay -> master
    gainNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay); // loop back
    delay.connect(this.masterGain);

    // Start and scheduled stop
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 4.5);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const ambientMusic = new AmbientSynthesizer();
