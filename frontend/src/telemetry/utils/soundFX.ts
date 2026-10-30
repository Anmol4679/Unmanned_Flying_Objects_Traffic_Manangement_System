// Web Audio API Synthesizer for Military Air Defense & Tactical Alarms
// Zero external sound assets needed - works 100% offline and instant

class SoundFX {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private warAlarmInterval: any = null;
  private isAlarmPlaying: boolean = false;

  private initCtx() {
    try {
      if (typeof window === "undefined") return;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn("AudioContext not permitted yet or not supported:", e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopWarAlarm();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Continuous Tactical War / Air-Raid Siren
   * Cycles pitch from 400Hz up to 900Hz with dramatic war harmonics
   */
  public startWarAlarm() {
    if (this.isMuted || this.isAlarmPlaying) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      this.isAlarmPlaying = true;

      const playCycle = () => {
        try {
          if (!this.ctx || !this.isAlarmPlaying || this.isMuted) return;

          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = "sawtooth";
          osc2.type = "square";

          const now = this.ctx.currentTime;
          osc1.frequency.setValueAtTime(450, now);
          osc1.frequency.exponentialRampToValueAtTime(850, now + 0.6);
          osc1.frequency.exponentialRampToValueAtTime(450, now + 1.2);

          osc2.frequency.setValueAtTime(455, now);
          osc2.frequency.exponentialRampToValueAtTime(855, now + 0.6);
          osc2.frequency.exponentialRampToValueAtTime(455, now + 1.2);

          gain.gain.setValueAtTime(0.18, now);
          gain.gain.setValueAtTime(0.22, now + 0.6);
          gain.gain.linearRampToValueAtTime(0.01, now + 1.25);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.25);
          osc2.stop(now + 1.25);
        } catch (e) {
          console.warn("Audio cycle error:", e);
        }
      };

      playCycle();
      this.warAlarmInterval = setInterval(playCycle, 1300);
    } catch (e) {
      console.warn("War alarm start failed:", e);
    }
  }

  public stopWarAlarm() {
    this.isAlarmPlaying = false;
    if (this.warAlarmInterval) {
      clearInterval(this.warAlarmInterval);
      this.warAlarmInterval = null;
    }
  }

  /**
   * Tactical Missile Threat / Lock-on Klaxon
   * High frequency urgent dual-tone pulses
   */
  public playMissileLock() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1200 + (i % 2 === 0 ? 0 : 350), now + i * 0.15);

        gain.gain.setValueAtTime(0.2, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.12);
      }
    } catch (e) {
      console.warn("Missile lock audio failed:", e);
    }
  }

  /**
   * Low Battery / Station Far Urgency Beep
   */
  public playBatteryAlert() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(650, now + i * 0.2);
        osc.frequency.exponentialRampToValueAtTime(350, now + i * 0.2 + 0.15);

        gain.gain.setValueAtTime(0.25, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.18);
      }
    } catch (e) {
      console.warn("Battery alert audio failed:", e);
    }
  }
}

export const soundFX = new SoundFX();
