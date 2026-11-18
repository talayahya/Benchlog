import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserVoice } from "../src/voice";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

class FakeUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const callbacks = () => ({
  onTranscript: vi.fn(),
  onInterim: vi.fn(),
  onStatus: vi.fn(),
  onError: vi.fn(),
});
const result = (transcript: string, isFinal = true) => ({
  0: { transcript },
  length: 1,
  isFinal,
});
const latest = () => FakeRecognition.instances.at(-1)!;
let speech: {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: () => never[];
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  speech = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };
  vi.stubGlobal("window", {
    SpeechRecognition: FakeRecognition,
    speechSynthesis: speech,
    SpeechSynthesisUtterance: FakeUtterance,
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BrowserVoice lifecycle", () => {
  it("does not start recording until start is called", () => {
    const voice = new BrowserVoice(callbacks());
    expect(BrowserVoice.supported()).toBe(true);
    expect(FakeRecognition.instances).toHaveLength(0);
    voice.start();
    expect(latest().start).toHaveBeenCalledOnce();
    expect(latest().lang).toBe("en-GB");
    voice.dispose();
  });

  it("deduplicates final result indexes, but accepts repeated user words at a new index", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    const recognizer = latest();
    const first = { resultIndex: 0, results: [result("save that")] };
    recognizer.onresult?.(first);
    recognizer.onresult?.(first);
    recognizer.onresult?.({
      resultIndex: 1,
      results: [result("save that"), result("save that")],
    });
    expect(cb.onTranscript.mock.calls).toEqual([["save that"], ["save that"]]);
    voice.dispose();
  });

  it("combines multiple final segments and keeps interim words out of the command", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    latest().onresult?.({
      resultIndex: 0,
      results: [
        result("at one kilohertz"),
        result("output one volt"),
        result("input", false),
      ],
    });
    expect(cb.onTranscript).toHaveBeenCalledWith(
      "at one kilohertz output one volt",
    );
    expect(cb.onInterim).toHaveBeenCalledWith("input");
    voice.dispose();
  });

  it("suspends the recognizer during speech and resumes after a short echo guard", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    const oldRecognizer = latest();
    const staleResult = oldRecognizer.onresult;
    voice.speak("Confirm one volt.");
    expect(oldRecognizer.abort).toHaveBeenCalledOnce();
    expect(oldRecognizer.onresult).toBeNull();
    staleResult?.({ resultIndex: 0, results: [result("confirm one volt")] });
    expect(cb.onTranscript).not.toHaveBeenCalled();
    expect(cb.onStatus).toHaveBeenLastCalledWith("speaking");
    const utterance = speech.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onend?.();
    vi.advanceTimersByTime(349);
    expect(FakeRecognition.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(cb.onStatus).toHaveBeenLastCalledWith("listening");
    voice.dispose();
  });

  it("stopping during readback cannot restart the microphone from a stale callback", () => {
    const voice = new BrowserVoice(callbacks());
    voice.start();
    voice.speak("Saved.");
    const utterance = speech.speak.mock.calls[0][0] as FakeUtterance;
    const staleEnd = utterance.onend;
    voice.stop();
    staleEnd?.();
    vi.runAllTimers();
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(speech.cancel).toHaveBeenCalledOnce();
  });

  it("never starts the microphone when standalone readback ends", () => {
    const voice = new BrowserVoice(callbacks());
    voice.speak("Here is your last reading.");
    (speech.speak.mock.calls[0][0] as FakeUtterance).onend?.();
    vi.runAllTimers();
    expect(FakeRecognition.instances).toHaveLength(0);
    voice.dispose();
  });

  it("does not retry permission denial", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    const staleEnd = latest().onend;
    latest().onerror?.({ error: "not-allowed" });
    staleEnd?.();
    vi.runAllTimers();
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(cb.onStatus).toHaveBeenLastCalledWith("error");
    expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining("denied"));
    voice.dispose();
  });

  it("bounds repeated immediate recognition endings", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    for (let attempt = 0; attempt < 4; attempt++) {
      latest().onend?.();
      vi.advanceTimersByTime(1000);
    }
    expect(FakeRecognition.instances).toHaveLength(4);
    expect(cb.onStatus).toHaveBeenLastCalledWith("error");
    vi.advanceTimersByTime(20_000);
    expect(FakeRecognition.instances).toHaveLength(4);
    voice.dispose();
  });

  it("recovers capture when readback is disabled mid-sentence", () => {
    const voice = new BrowserVoice(callbacks());
    voice.start();
    voice.speak("A long response.");
    voice.setReadback(false);
    vi.advanceTimersByTime(350);
    expect(FakeRecognition.instances).toHaveLength(2);
    voice.speak("Should stay silent.");
    expect(speech.speak).toHaveBeenCalledTimes(1);
    voice.dispose();
  });

  it("surfaces absent speech synthesis without interrupting recognition", () => {
    vi.stubGlobal("window", { SpeechRecognition: FakeRecognition });
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    voice.speak("Saved.");
    expect(latest().abort).not.toHaveBeenCalled();
    expect(cb.onError).toHaveBeenCalledWith(
      expect.stringContaining("readback is unavailable"),
    );
    voice.dispose();
  });

  it("ignores all old callbacks and calls after disposal", () => {
    const cb = callbacks();
    const voice = new BrowserVoice(cb);
    voice.start();
    const stale = latest().onresult;
    voice.dispose();
    cb.onTranscript.mockClear();
    cb.onStatus.mockClear();
    stale?.({ resultIndex: 0, results: [result("save")] });
    voice.start();
    voice.speak("hello");
    voice.stop();
    vi.runAllTimers();
    expect(cb.onTranscript).not.toHaveBeenCalled();
    expect(cb.onStatus).not.toHaveBeenCalled();
    expect(FakeRecognition.instances).toHaveLength(1);
  });
});
