/**
 * Browser speech adapter. The browser chooses the recognition service; audio may
 * leave the device. This class makes no offline or transcript-confidence claim.
 * Recognition and readback are deliberately half-duplex to avoid transcribing
 * the app's own voice. start() is the only method that requests a live session.
 */
export type VoiceStatus =
  "idle" | "listening" | "thinking" | "speaking" | "error";

type Callbacks = {
  onTranscript: (text: string) => void;
  onInterim: (text: string) => void;
  onStatus: (status: VoiceStatus) => void;
  onError: (message: string) => void;
};

// SpeechRecognition is still prefixed in some browsers and absent from lib.dom.
type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};
type RecognitionEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

const errorMessages: Record<string, string> = {
  "not-allowed":
    "Microphone access was denied. Allow microphone access in your browser, then choose Start listening again. You can also type a command.",
  "service-not-allowed":
    "This browser has blocked its speech recognition service. Try the on-device transcription option or type a command.",
  "audio-capture":
    "No working microphone was found. Check your microphone connection and browser permissions, then try again.",
  network:
    "The browser speech service could not connect. Check your connection, use on-device transcription, or type a command.",
  "language-not-supported":
    "This browser speech service does not support British English. Use on-device transcription or type a command.",
};

export class BrowserVoice {
  private readonly callbacks: Callbacks;
  private recognition: Recognition | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private requested = false;
  private disposed = false;
  private readback = true;
  private generation = 0;
  private speechGeneration = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private recognitionStartTimer: ReturnType<typeof setTimeout> | null = null;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private emptyRestarts = 0;
  private status: VoiceStatus = "idle";

  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks;
  }

  static supported(): boolean {
    return Boolean(BrowserVoice.recognitionConstructor());
  }

  private static recognitionConstructor(): RecognitionConstructor | undefined {
    if (typeof window === "undefined") return undefined;
    const speechWindow = window as SpeechWindow;
    return (
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    );
  }

  start(): void {
    if (this.disposed) return;
    if (!BrowserVoice.supported()) {
      this.fail(
        "Live browser recognition is unavailable here. Use on-device transcription or type a command.",
      );
      return;
    }
    this.requested = true;
    this.emptyRestarts = 0;
    if (this.recognition || this.utterance) return;
    this.clearRestart();
    this.beginListening();
  }

  stop(): void {
    if (this.disposed) return;
    this.requested = false;
    this.clearRestart();
    this.detachRecognition();
    this.cancelReadback();
    this.callbacks.onInterim("");
    this.setStatus("idle");
  }

  setReadback(enabled: boolean): void {
    if (this.disposed) return;
    this.readback = enabled;
    if (!enabled && this.utterance) {
      this.cancelReadback();
      this.resumeAfterReadback();
    }
  }

  speak(text: string): void {
    if (this.disposed || !this.readback || !text.trim()) return;
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance !== "function"
    ) {
      this.callbacks.onError(
        "Spoken readback is unavailable in this browser. The response is still shown on screen.",
      );
      return;
    }

    this.clearRestart();
    this.detachRecognition();
    this.cancelReadback();
    this.callbacks.onInterim("");
    const generation = ++this.speechGeneration;
    const utterance = new window.SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.lang = "en-GB";
    utterance.rate = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.toLowerCase() === "en-gb");
    if (voice) utterance.voice = voice;
    const current = () =>
      !this.disposed &&
      generation === this.speechGeneration &&
      this.utterance === utterance;
    const finished = (message?: string) => {
      if (!current()) return;
      this.clearSpeechTimer();
      this.utterance = null;
      utterance.onend = null;
      utterance.onerror = null;
      if (message) this.callbacks.onError(message);
      this.resumeAfterReadback();
    };
    utterance.onend = () => finished();
    utterance.onerror = () =>
      finished(
        "Spoken readback was interrupted. The response is still shown on screen.",
      );
    this.setStatus("speaking");
    // Some implementations never emit end/error after a suspended audio device.
    this.speechTimer = setTimeout(
      () => {
        if (!current()) return;
        this.cancelReadback();
        this.callbacks.onError(
          "Spoken readback timed out. The response is still shown on screen.",
        );
        this.resumeAfterReadback();
      },
      Math.min(90_000, Math.max(15_000, text.length * 100 + 6_000)),
    );
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finished(
        "Spoken readback could not start. The response is still shown on screen.",
      );
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private beginListening(): void {
    if (this.disposed || !this.requested || this.recognition || this.utterance)
      return;
    const Constructor = BrowserVoice.recognitionConstructor();
    if (!Constructor) {
      this.fail(
        "Live browser recognition is unavailable here. Use on-device transcription or type a command.",
      );
      return;
    }
    let recognition: Recognition;
    try {
      recognition = new Constructor();
    } catch {
      this.fail(
        "The browser could not initialise speech recognition. Try again or type a command.",
      );
      return;
    }
    const generation = ++this.generation;
    const current = () =>
      !this.disposed &&
      this.requested &&
      generation === this.generation &&
      this.recognition === recognition;
    const delivered = new Set<number>();
    const startedAt = Date.now();
    this.recognition = recognition;
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (!current()) return;
      this.clearRecognitionStartTimer();
      this.setStatus("listening");
    };
    recognition.onresult = (event) => {
      if (!current()) return;
      this.emptyRestarts = 0;
      const interim: string[] = [];
      const final: string[] = [];
      const startIndex = Math.max(
        0,
        Number.isFinite(event.resultIndex) ? event.resultIndex : 0,
      );
      for (let index = startIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const text = result?.[0]?.transcript.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          if (delivered.has(index)) continue;
          delivered.add(index);
          final.push(text);
        } else {
          interim.push(text);
        }
      }
      // An event can contain several final segments. Deliver together before
      // the consumer starts readback, which intentionally stops recognition.
      if (final.length) this.callbacks.onTranscript(final.join(" "));
      if (current()) this.callbacks.onInterim(interim.join(" "));
    };
    recognition.onerror = (event) => {
      if (!current()) return;
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.fail(
        errorMessages[event.error] ??
          "Speech recognition stopped unexpectedly. Choose Start listening to retry, or type a command.",
      );
    };
    recognition.onend = () => {
      if (!current()) return;
      this.detachRecognition(false);
      this.callbacks.onInterim("");
      // Ordinary long-running service timeouts are safe to restart. Rapid empty
      // endings are bounded so a broken service never spins or re-prompts.
      this.emptyRestarts =
        Date.now() - startedAt >= 4_000 ? 0 : this.emptyRestarts + 1;
      if (this.emptyRestarts >= 4) {
        this.fail(
          "The speech service keeps stopping. Check your microphone and connection, then choose Start listening to retry.",
        );
        return;
      }
      this.scheduleListening(
        Math.min(1_000, 250 * Math.max(1, this.emptyRestarts)),
      );
    };
    this.setStatus("thinking");
    this.recognitionStartTimer = setTimeout(() => {
      if (current())
        this.fail(
          "The speech service did not start. Check the browser microphone prompt, then choose Start listening to retry.",
        );
    }, 12_000);
    try {
      recognition.start();
    } catch {
      this.fail(
        "Speech recognition could not start. Check microphone permissions, then choose Start listening to retry.",
      );
    }
  }

  private resumeAfterReadback(): void {
    if (this.disposed) return;
    if (this.requested) this.scheduleListening(350);
    else this.setStatus("idle");
  }

  private scheduleListening(delay: number): void {
    this.clearRestart();
    if (!this.requested || this.disposed) return;
    this.setStatus("thinking");
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.beginListening();
    }, delay);
  }

  private detachRecognition(abort = true): void {
    ++this.generation;
    this.clearRecognitionStartTimer();
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    if (abort) {
      try {
        recognition.abort();
      } catch {
        /* Already ended or not yet started. */
      }
    }
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

  private clearSpeechTimer(): void {
    if (this.speechTimer !== null) clearTimeout(this.speechTimer);
    this.speechTimer = null;
  }

  private clearRecognitionStartTimer(): void {
    if (this.recognitionStartTimer !== null)
      clearTimeout(this.recognitionStartTimer);
    this.recognitionStartTimer = null;
  }

  private clearRestart(): void {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  private fail(message: string): void {
    if (this.disposed) return;
    this.requested = false;
    this.clearRestart();
    this.detachRecognition();
    this.callbacks.onInterim("");
    this.setStatus("error");
    this.callbacks.onError(message);
  }

  private setStatus(status: VoiceStatus): void {
    if (this.disposed || this.status === status) return;
    this.status = status;
    this.callbacks.onStatus(status);
  }
}
