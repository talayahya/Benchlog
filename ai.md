# AI assistance disclosure

## Development assistance

Benchlog was developed with substantial assistance from **OpenAI ChatGPT/Codex**. Tala asked for a complete voice-driven prototype based on her interests, with company/product research, a deliberate visual design and a GitHub-ready codebase.

The assistant selected the electronics-notebook concept using the supplied context about Tala's RC circuit studies and interest in lab instruments. It researched Hiya's public materials, voice-interface guidance, speech-recognition options, technical reference material and design/accessibility sources. It also implemented the React/TypeScript interface, command engine, audio adapters, storage, charts, tests and documentation.

Parallel Codex agents assisted with company/design research, the deterministic measurement engine, the browser voice adapter, tests and supporting documents. Their work was integrated and reviewed by the coordinating assistant. No claim is made that independent agents replace human review.

This includes the one-page write-up and demonstration/review material. The repository does not claim that Tala wrote all of the code unaided, ran a physical circuit trial or independently verified each subsystem. The plain-language review guide is intended to help her understand the code, exercise it and prepare to discuss decisions and limitations herself.

## AI at runtime

The application uses pretrained **automatic speech recognition** to convert audio into text:

- The browser speech path uses the recognition service exposed by the user's browser. The underlying provider/model depends on that browser and may involve remote processing.
- The optional local path uses `onnx-community/whisper-tiny.en` through Hugging Face Transformers.js, with `q8` quantisation and WASM in a worker. It downloads model resources before local inference.

The command parser, unit validation, confirmation flow, record history, RC equations and exports are deterministic TypeScript. No LLM generates measurements or invents missing units. The typed-input path does not invoke speech AI. Spoken read-back uses browser speech synthesis rather than a custom-trained voice model.

## Verification boundaries

Automated tests and build checks should be judged by their actual output. Mocked browser-recognition tests check lifecycle and application behaviour, not acoustic accuracy. Synthetic example readings are labelled and kept separate from the user's notebook. They are not evidence from a real circuit or a user study.

No quantified recognition accuracy, latency, time saving or fairness result is claimed. Recognition errors, unsupported phrasing, device differences and lab noise remain limitations to investigate. The design research records sources and distinguishes empirical evidence from the assistant's implementation judgments.
