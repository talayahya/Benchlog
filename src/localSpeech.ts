type Pending = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  removeAbort: () => void;
};

const cancelled = () =>
  new DOMException("Local speech cancelled.", "AbortError");

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Owns one inference worker. Cancellation terminates pending inference safely. */
export class LocalSpeech {
  private worker: Worker | null = null;
  private sequence = 0;
  private disposed = false;
  private waiting = new Map<number, Pending>();
  private decoders = new Set<AbortController>();

  constructor(private progress: (text: string) => void) {}

  private getWorker(): Worker {
    if (this.disposed) throw new Error("Local speech is closed.");
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (this.disposed || this.worker !== worker || !data) return;
      if (data.type === "progress") {
        if (!this.waiting.size) return;
        const p = data.progress;
        if (p?.status === "progress") {
          const amount = Number.isFinite(p.progress)
            ? Math.max(0, Math.min(100, Math.round(p.progress)))
            : 0;
          this.progress(
            "Loading speech model: " +
              (p.file?.split("/").pop() ?? "download") +
              " " +
              amount +
              "%",
          );
        } else if (p?.status === "initiate")
          this.progress("Downloading the local speech model…");
        return;
      }
      if (!["ready", "result", "error"].includes(data.type)) return;
      const entry = this.waiting.get(data.id);
      if (!entry) return;
      this.waiting.delete(data.id);
      clearTimeout(entry.timer);
      entry.removeAbort();
      if (data.type === "error")
        entry.reject(
          new Error(String(data.message || "Local transcription failed.")),
        );
      else entry.resolve(typeof data.text === "string" ? data.text : "");
    };
    worker.onerror = () => {
      if (this.worker === worker)
        this.resetWorker(
          new Error(
            "Local speech could not start. Try browser speech or type a reading.",
          ),
        );
    };
    worker.onmessageerror = () => {
      if (this.worker === worker)
        this.resetWorker(
          new Error(
            "The local speech worker returned unreadable data. Please try again.",
          ),
        );
    };
    return worker;
  }

  private resetWorker(error: Error): void {
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }
    for (const entry of this.waiting.values()) {
      clearTimeout(entry.timer);
      entry.removeAbort();
      entry.reject(error);
    }
    this.waiting.clear();
  }

  private request(
    type: "load" | "transcribe",
    audio?: Float32Array,
    signal?: AbortSignal,
  ): Promise<string> {
    if (this.disposed)
      return Promise.reject(new Error("Local speech is closed."));
    if (signal?.aborted) return Promise.reject(cancelled());
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const abort = () => this.resetWorker(cancelled());
      const timer = setTimeout(() => {
        this.resetWorker(
          new Error(
            "Speech processing timed out. Check your connection for the first download, or try browser speech.",
          ),
        );
      }, 180_000);
      const removeAbort = () => signal?.removeEventListener("abort", abort);
      this.waiting.set(id, { resolve, reject, timer, removeAbort });
      signal?.addEventListener("abort", abort, { once: true });
      try {
        this.getWorker().postMessage({ id, type, audio });
      } catch (error) {
        this.resetWorker(
          error instanceof Error
            ? error
            : new Error("Local speech could not start."),
        );
      }
    });
  }

  load(signal?: AbortSignal): Promise<string> {
    return this.request("load", undefined, signal);
  }

  async transcribe(blob: Blob, signal?: AbortSignal): Promise<string> {
    if (this.disposed) throw new Error("Local speech is closed.");
    if (signal?.aborted) throw cancelled();
    if (blob.size > 10 * 1024 * 1024)
      throw new Error("Choose an audio clip smaller than 10 MB.");
    if (!blob.size)
      throw new Error("The recording is empty. Please try again.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    this.decoders.add(controller);
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const bytes = await abortable(blob.arrayBuffer(), controller.signal);
      const decoded = await abortable(
        context.decodeAudioData(bytes),
        controller.signal,
      );
      if (
        !Number.isFinite(decoded.duration) ||
        decoded.duration > 30 ||
        decoded.duration < 0.1
      ) {
        throw new Error("Choose a clip between 0.1 and 30 seconds.");
      }
      const offline = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * 16000),
        16000,
      );
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await abortable(
        offline.startRendering(),
        controller.signal,
      );
      const data = rendered.getChannelData(0);
      let power = 0;
      for (const sample of data) power += sample * sample;
      if (
        !data.length ||
        !Number.isFinite(power) ||
        Math.sqrt(power / data.length) < 0.003
      ) {
        throw new Error(
          "This recording is very quiet. Speak closer to the microphone and try again.",
        );
      }
      return await this.request("transcribe", data, controller.signal);
    } finally {
      signal?.removeEventListener("abort", abort);
      this.decoders.delete(controller);
      if (context && context.state !== "closed")
        await context.close().catch(() => {});
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const decoder of this.decoders) decoder.abort();
    this.decoders.clear();
    this.resetWorker(new Error("Local speech closed."));
  }
}
