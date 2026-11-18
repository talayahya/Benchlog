import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalVoice } from "../src/localVoice";

const speechMock = vi.hoisted(() => ({
  load: vi.fn(),
  transcribe: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("../src/localSpeech", () => ({
  LocalSpeech: class {
    load = speechMock.load;
    transcribe = speechMock.transcribe;
    dispose = speechMock.dispose;
    constructor(_progress: (text: string) => void) {}
  },
}));
const RealSpeech = (
  await vi.importActual<typeof import("../src/localSpeech")>(
    "../src/localSpeech",
  )
).LocalSpeech;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class FakeContext {
  static instances: FakeContext[] = [];
  static level = 0;
  static resumeImpl = () => Promise.resolve();
  state = "running";
  resume = vi.fn(() => FakeContext.resumeImpl());
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createAnalyser = vi.fn(() => ({
    fftSize: 2048,
    getFloatTimeDomainData: (samples: Float32Array) =>
      samples.fill(FakeContext.level),
  }));
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  constructor() {
    FakeContext.instances.push(this);
  }
}
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    this.onstop?.();
  });
  constructor(_stream: MediaStream) {
    FakeRecorder.instances.push(this);
  }
}
class FakeUtterance {
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(_url: URL, _options: unknown) {
    FakeWorker.instances.push(this);
  }
}
const callbacks = () => ({
  onTranscript: vi.fn(),
  onInterim: vi.fn(),
  onStatus: vi.fn(),
  onError: vi.fn(),
});
const recorder = () => FakeRecorder.instances.at(-1)!;
const localVoice = { lang: "en-GB", localService: true, name: "Local English" };
const remoteVoice = {
  lang: "en-GB",
  localService: false,
  name: "Remote English",
};
let track: { stop: ReturnType<typeof vi.fn> };
let stream: MediaStream;
let getUserMedia: ReturnType<typeof vi.fn>;
let synthesis: {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeContext.instances = [];
  FakeContext.level = 0;
  FakeContext.resumeImpl = () => Promise.resolve();
  FakeRecorder.instances = [];
  FakeWorker.instances = [];
  speechMock.load.mockResolvedValue("");
  speechMock.transcribe.mockResolvedValue("At one kilohertz output one volt");
  track = { stop: vi.fn() };
  stream = { getTracks: () => [track] } as unknown as MediaStream;
  getUserMedia = vi.fn().mockResolvedValue(stream);
  synthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [remoteVoice, localVoice]),
  };
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("window", { speechSynthesis: synthesis });
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LocalVoice lifecycle", () => {
  it("starts one recorder only after explicit start and ignores duplicate starts", async () => {
    const voice = new LocalVoice(callbacks());
    expect(getUserMedia).not.toHaveBeenCalled();
    await Promise.all([voice.start(), voice.start()]);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(1);
    voice.dispose();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("closes a microphone granted after Stop without creating a recorder", async () => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const voice = new LocalVoice(callbacks());
    const starting = voice.start();
    await Promise.resolve();
    voice.stop();
    permission.resolve(stream);
    await starting;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(0);
    voice.dispose();
  });

  it("does not capture if Stop occurs while AudioContext.resume is pending", async () => {
    const resumed = deferred<void>();
    FakeContext.resumeImpl = () => resumed.promise;
    const voice = new LocalVoice(callbacks());
    const starting = voice.start();
    await Promise.resolve();
    await Promise.resolve();
    voice.stop();
    resumed.resolve();
    await starting;
    expect(track.stop).toHaveBeenCalled();
    expect(FakeContext.instances[0].close).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it("catches denied microphone permission and ends the session", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"));
    const cb = callbacks();
    const voice = new LocalVoice(cb);
    await expect(voice.start()).resolves.toBeUndefined();
    expect(cb.onStatus).toHaveBeenLastCalledWith("error");
    expect(cb.onError).toHaveBeenCalledWith("Permission denied");
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it("preserves short pauses and resumes after a transcribed turn without readback", async () => {
    const cb = callbacks();
    const voice = new LocalVoice(cb);
    await voice.start();
    FakeContext.level = 0.05;
    await vi.advanceTimersByTimeAsync(160);
    FakeContext.level = 0;
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorder().stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(speechMock.transcribe).toHaveBeenCalledOnce();
    expect(cb.onTranscript).toHaveBeenCalledWith(
      "At one kilohertz output one volt",
    );
    await vi.advanceTimersByTimeAsync(350);
    expect(FakeRecorder.instances).toHaveLength(2);
    voice.dispose();
  });

  it("discards a live recording before typed-interaction readback and resumes once", async () => {
    const voice = new LocalVoice(callbacks());
    await voice.start();
    const first = recorder();
    voice.speak("Saved the reading.");
    expect(first.stop).toHaveBeenCalledOnce();
    expect(first.onstop).toBeNull();
    expect(speechMock.transcribe).not.toHaveBeenCalled();
    expect((synthesis.speak.mock.calls[0][0] as FakeUtterance).voice).toBe(
      localVoice,
    );
    (synthesis.speak.mock.calls[0][0] as FakeUtterance).onend?.();
    await vi.advanceTimersByTimeAsync(350);
    expect(FakeRecorder.instances).toHaveLength(2);
    voice.dispose();
  });

  it("does not create a second recorder when readback is disabled during capture", async () => {
    const voice = new LocalVoice(callbacks());
    await voice.start();
    voice.setReadback(false);
    voice.speak("A typed response.");
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(synthesis.speak).not.toHaveBeenCalled();
    voice.dispose();
  });

  it("uses text fallback instead of a remote English synthesis voice", async () => {
    synthesis.getVoices.mockReturnValue([remoteVoice]);
    const cb = callbacks();
    const voice = new LocalVoice(cb);
    await voice.start();
    voice.speak("One volt.");
    await vi.advanceTimersByTimeAsync(100);
    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(cb.onError).toHaveBeenCalledWith(
      expect.stringContaining("No on-device English"),
    );
    expect(FakeRecorder.instances).toHaveLength(1);
    voice.dispose();
  });

  it("cancels stuck speech before watchdog resumes capture", async () => {
    const voice = new LocalVoice(callbacks());
    await voice.start();
    voice.speak("Saved.");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(350);
    expect(FakeRecorder.instances).toHaveLength(2);
    voice.dispose();
  });

  it("Stop clears the speech watchdog and stale endings cannot reactivate capture", async () => {
    const cb = callbacks();
    const voice = new LocalVoice(cb);
    await voice.start();
    voice.speak("Saved.");
    const staleEnd = (synthesis.speak.mock.calls[0][0] as FakeUtterance).onend;
    voice.stop();
    staleEnd?.();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(cb.onStatus).toHaveBeenLastCalledWith("idle");
    expect(cb.onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an inference result arriving after Stop", async () => {
    const inference = deferred<string>();
    speechMock.transcribe.mockReturnValue(inference.promise);
    const cb = callbacks();
    const voice = new LocalVoice(cb);
    await voice.start();
    FakeContext.level = 0.05;
    await vi.advanceTimersByTimeAsync(160);
    FakeContext.level = 0;
    await vi.advanceTimersByTimeAsync(1400);
    voice.stop();
    expect(speechMock.transcribe.mock.calls[0][1].aborted).toBe(true);
    inference.resolve("Save this stale reading");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(500);
    expect(cb.onTranscript).not.toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(1);
  });
});

describe("LocalSpeech worker ownership", () => {
  it("resolves a load only from its matching worker reply and ignores duplicates", async () => {
    const speech = new RealSpeech(vi.fn());
    const pending = speech.load();
    const worker = FakeWorker.instances[0];
    const id = worker.postMessage.mock.calls[0][0].id;
    worker.onmessage?.({ data: { type: "unrecognised", id } });
    expect(vi.getTimerCount()).toBe(1);
    worker.onmessage?.({ data: { type: "ready", id } });
    await expect(pending).resolves.toBe("");
    worker.onmessage?.({ data: { type: "ready", id } });
    expect(vi.getTimerCount()).toBe(0);
    speech.dispose();
  });

  it("aborting a pending load terminates its worker and suppresses late progress", async () => {
    const progress = vi.fn();
    const speech = new RealSpeech(progress);
    const controller = new AbortController();
    const pending = speech.load(controller.signal);
    const expectation = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    const worker = FakeWorker.instances[0];
    const staleMessage = worker.onmessage;
    controller.abort();
    await expectation;
    staleMessage?.({
      data: { type: "progress", progress: { status: "initiate" } },
    });
    expect(progress).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    speech.dispose();
  });

  it("terminates a timed-out worker so another call can retry cleanly", async () => {
    const speech = new RealSpeech(vi.fn());
    const failed = expect(speech.load()).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(180_000);
    await failed;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    const pending = speech.load();
    const worker = FakeWorker.instances[1];
    worker.onmessage?.({
      data: { type: "ready", id: worker.postMessage.mock.calls[0][0].id },
    });
    await expect(pending).resolves.toBe("");
    speech.dispose();
  });

  it("rejects pending work on disposal and cannot create a replacement worker", async () => {
    const speech = new RealSpeech(vi.fn());
    const pending = expect(speech.load()).rejects.toThrow("closed");
    speech.dispose();
    await pending;
    await expect(speech.load()).rejects.toThrow("closed");
    await expect(speech.transcribe(new Blob(["audio"]))).rejects.toThrow(
      "closed",
    );
    expect(FakeWorker.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
