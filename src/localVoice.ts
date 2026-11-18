import { LocalSpeech } from "./localSpeech";
import type { VoiceStatus } from "./voice";

type Callbacks = {
  onTranscript: (text: string) => void;
  onInterim: (text: string) => void;
  onStatus: (status: VoiceStatus) => void;
  onError: (message: string) => void;
};

/** Energy-based, silence-delimited turns. No instrument control or audio upload. */
export class LocalVoice {
  private readonly speech: LocalSpeech;
  private wanted = false;
  private disposed = false;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private generation = 0;
  private captureGeneration = 0;
  private speechGeneration = 0;
  private readback = true;
  private transcribing = false;
  private sessionAbort: AbortController | null = null;
  private turnAbort: AbortController | null = null;

  constructor(private cb: Callbacks) {
    this.speech = new LocalSpeech((text) => {
      if (this.wanted && !this.disposed) cb.onInterim(text);
    });
  }

  setReadback(enabled: boolean): void {
    if (this.disposed) return;
    this.readback = enabled;
    if (!enabled && this.utterance) {
      this.cancelReadback();
      this.scheduleCapture(350);
    }
  }

  async start(): Promise<void> {
    if (this.disposed || this.wanted) return;
    const generation = ++this.generation;
    this.wanted = true;
    const controller = new AbortController();
    this.sessionAbort = controller;
    const current = () =>
      this.wanted && !this.disposed && generation === this.generation;
    this.cb.onStatus("thinking");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined" ||
        typeof AudioContext === "undefined"
      ) {
        throw new Error(
          "Local microphone capture is unavailable in this browser. Try browser speech or upload an audio clip.",
        );
      }
      await this.speech.load(controller.signal);
      if (!current()) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        if (context.state !== "closed") await context.close().catch(() => {});
        return;
      }
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(this.analyser);
      this.capture();
    } catch (error) {
      if (!current()) return;
      this.fail(
        error instanceof Error ? error.message : "Microphone unavailable.",
      );
    }
  }

  private capture(): void {
    if (
      !this.wanted ||
      this.disposed ||
      !this.stream ||
      !this.analyser ||
      this.recorder ||
      this.transcribing ||
      this.utterance
    )
      return;
    const generation = this.generation;
    const captureGeneration = ++this.captureGeneration;
    const current = () =>
      this.wanted &&
      !this.disposed &&
      generation === this.generation &&
      captureGeneration === this.captureGeneration;
    const chunks: Blob[] = [];
    let heard = false;
    let voicedFrames = 0;
    let lastVoice = performance.now();
    const started = performance.now();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(this.stream);
    } catch {
      this.fail(
        "This browser could not record microphone audio. Try browser speech or upload a clip.",
      );
      return;
    }
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (current() && event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (current())
        this.fail(
          "The microphone recording failed. Check your audio device and start a new session.",
        );
    };
    recorder.onstop = () => {
      if (!current()) return;
      this.clearVadTimer();
      this.recorder = null;
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (!heard) {
        this.scheduleCapture(0);
        return;
      }
      void this.finishTurn(
        new Blob(chunks, { type: recorder.mimeType }),
        generation,
        captureGeneration,
      );
    };
    try {
      recorder.start();
    } catch {
      this.fail(
        "Microphone recording could not start. Try browser speech or upload a clip.",
      );
      return;
    }
    this.cb.onInterim("");
    this.cb.onStatus("listening");
    const analyser = this.analyser;
    const samples = new Float32Array(analyser.fftSize);
    const check = () => {
      if (!current() || recorder.state !== "recording") return;
      try {
        analyser.getFloatTimeDomainData(samples);
      } catch {
        this.fail(
          "The microphone stream stopped. Start a new session to reconnect.",
        );
        return;
      }
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const now = performance.now();
      if (Math.sqrt(sum / samples.length) > 0.012) {
        voicedFrames++;
        if (voicedFrames >= 2) heard = true;
        lastVoice = now;
      } else if (!heard) voicedFrames = 0;
      // Preserve short pauses between values and units. Rotate empty recordings
      // so lengthy silence does not consume most of the 30-second model limit.
      if (
        (heard && now - lastVoice > 1200) ||
        now - started > 28_000 ||
        (!heard && now - started > 8_000)
      ) {
        this.clearVadTimer();
        try {
          recorder.stop();
        } catch {
          this.fail(
            "The recording could not finish. Please start a new voice session.",
          );
        }
        return;
      }
      this.timer = setTimeout(check, 80);
    };
    check();
  }

  private async finishTurn(
    blob: Blob,
    generation: number,
    captureGeneration: number,
  ): Promise<void> {
    const current = () =>
      this.wanted &&
      !this.disposed &&
      generation === this.generation &&
      captureGeneration === this.captureGeneration;
    if (!current()) return;
    const controller = new AbortController();
    this.turnAbort = controller;
    this.transcribing = true;
    this.cb.onStatus("thinking");
    this.cb.onInterim("Transcribing on this device…");
    try {
      const text = await this.speech.transcribe(blob, controller.signal);
      if (!current()) return;
      this.transcribing = false;
      this.turnAbort = null;
      this.cb.onInterim("");
      if (text.trim()) this.cb.onTranscript(text.trim());
      else this.cb.onError("No words were recognised. Try again.");
      // Consumers may choose no spoken response. Keep that session moving too.
      if (current() && !this.utterance) this.scheduleCapture(350);
    } catch (error) {
      if (!current()) return;
      this.transcribing = false;
      this.turnAbort = null;
      this.cb.onInterim("");
      this.cb.onError(
        error instanceof Error ? error.message : "Could not transcribe.",
      );
      this.scheduleCapture(350);
    }
  }

  speak(text: string): void {
    if (!this.wanted || this.disposed) return;
    if (!this.readback || !text.trim()) {
      this.scheduleCapture(0);
      return;
    }
    // Local mode must not send transcripts to a remote synthesis service.
    const synthesis = window.speechSynthesis;
    const voices = synthesis?.getVoices() ?? [];
    const localEnglish =
      voices.find(
        (voice) => voice.localService && voice.lang.toLowerCase() === "en-gb",
      ) ??
      voices.find(
        (voice) => voice.localService && /^en(?:-|$)/i.test(voice.lang),
      );
    if (
      !synthesis ||
      typeof SpeechSynthesisUtterance !== "function" ||
      !localEnglish
    ) {
      this.cb.onError(
        "No on-device English readback voice is available. The response is shown on screen; local transcription remains available.",
      );
      this.scheduleCapture(0);
      return;
    }
    // Typed or button interactions can request speech during a live recording.
    // Discard that unfinished turn before playing any sound.
    this.pauseCapture();
    this.cancelReadback();
    const generation = this.generation;
    const speechGeneration = ++this.speechGeneration;
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.voice = localEnglish;
    utterance.lang = localEnglish.lang;
    utterance.rate = 1.03;
    const current = () =>
      this.wanted &&
      !this.disposed &&
      generation === this.generation &&
      speechGeneration === this.speechGeneration &&
      this.utterance === utterance;
    const finish = (message?: string) => {
      if (!current()) return;
      this.clearSpeechTimer();
      this.utterance = null;
      utterance.onend = null;
      utterance.onerror = null;
      if (message) this.cb.onError(message);
      this.scheduleCapture(350);
    };
    utterance.onend = () => finish();
    utterance.onerror = () =>
      finish(
        "Spoken readback was interrupted. The response is shown on screen.",
      );
    this.cb.onStatus("speaking");
    this.speechTimer = setTimeout(
      () => {
        if (!current()) return;
        this.cancelReadback();
        this.cb.onError(
          "Spoken readback timed out. The response is shown on screen.",
        );
        this.scheduleCapture(350);
      },
      Math.min(90_000, Math.max(15_000, text.length * 100 + 6_000)),
    );
    try {
      synthesis.speak(utterance);
    } catch {
      finish(
        "Spoken readback could not start. The response is shown on screen.",
      );
    }
  }

  private pauseCapture(): void {
    ++this.captureGeneration;
    this.clearVadTimer();
    this.clearResumeTimer();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* Already stopped. */
        }
      }
    }
    this.turnAbort?.abort();
    this.turnAbort = null;
    this.transcribing = false;
  }

  private scheduleCapture(delay: number): void {
    this.clearResumeTimer();
    if (
      !this.wanted ||
      this.disposed ||
      this.recorder ||
      this.transcribing ||
      this.utterance
    )
      return;
    this.cb.onStatus("thinking");
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      this.capture();
    }, delay);
  }

  private clearVadTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private clearResumeTimer(): void {
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }
  private clearSpeechTimer(): void {
    if (this.speechTimer !== null) clearTimeout(this.speechTimer);
    this.speechTimer = null;
  }

  private cancelReadback(): void {
    ++this.speechGeneration;
    this.clearSpeechTimer();
    const utterance = this.utterance;
    this.utterance = null;
    if (!utterance) return;
    utterance.onend = null;
    utterance.onerror = null;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* Audio service disappeared. */
    }
  }

  stop(): void {
    if (this.disposed) return;
    this.wanted = false;
    ++this.generation;
    this.sessionAbort?.abort();
    this.sessionAbort = null;
    this.pauseCapture();
    this.cancelReadback();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const context = this.context;
    this.context = null;
    this.analyser = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
    this.cb.onInterim("");
    this.cb.onStatus("idle");
  }

  private fail(message: string): void {
    this.stop();
    if (!this.disposed) {
      this.cb.onStatus("error");
      this.cb.onError(message);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.speech.dispose();
  }
}
