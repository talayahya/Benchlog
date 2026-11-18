import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
env.allowLocalModels = false;
// A dedicated worker keeps model inference off the interface thread.
env.backends.onnx.wasm!.numThreads = 1;
let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
self.onmessage = async ({
  data,
}: {
  data: { id: number; audio?: Float32Array; type: "load" | "transcribe" };
}) => {
  try {
    transcriber ??= pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-tiny.en",
      {
        dtype: "q8",
        device: "wasm",
        progress_callback: (progress: unknown) =>
          self.postMessage({ type: "progress", progress }),
      },
    );
    const pipe = await transcriber;
    if (data.type === "load") {
      self.postMessage({ type: "ready", id: data.id });
      return;
    }
    if (!data.audio || data.audio.length < 1600 || data.audio.length > 480000)
      throw new Error("Use a recording between 0.1 and 30 seconds.");
    const result = await pipe(data.audio, {
      return_timestamps: false,
      max_new_tokens: 96,
    });
    const text = Array.isArray(result)
      ? result.map((r) => r.text).join(" ")
      : result.text;
    self.postMessage({ type: "result", id: data.id, text: text.trim() });
  } catch (error) {
    transcriber = null;
    self.postMessage({
      type: "error",
      id: data.id,
      message:
        error instanceof Error ? error.message : "Speech recognition failed.",
    });
  }
};
