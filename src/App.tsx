import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  createSession,
  handleUtterance,
  cutoffHz,
  measuredGainDb,
  formatFrequency,
  formatVoltage,
  validateConfig,
  toCsv,
  toMarkdown,
  type Config,
  type Session,
  type Source,
} from "./engine";
import { BrowserVoice, type VoiceStatus } from "./voice";
import { LocalVoice } from "./localVoice";
import { LocalSpeech } from "./localSpeech";
import { loadSession, saveSession, download } from "./storage";
import Plot from "./Plot";
import Schematic from "./Schematic";
import Investigation from "./InvestigationPanel";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    mic: (
      <>
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </>
    ),
    stop: <rect x="5" y="5" width="14" height="14" rx="1" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    undo: (
      <>
        <path d="m8 3-5 5 5 5M3 8h10a7 7 0 0 1 0 14" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8z" />,
    book: (
      <>
        <path d="M4 3h13a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2M3 17h16M7 7h8M7 11h6" />
      </>
    ),
    sound: (
      <>
        <path d="M4 9h4l5-4v14l-5-4H4zM17 8a7 7 0 0 1 0 8M20 5a11 11 0 0 1 0 14" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 1 1 4 3c-1 0-1 1-1 3M12 17h.01" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    file: (
      <>
        <path d="M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.book}
    </svg>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
type ExampleStep = {
  label: string;
  text: string;
  detail: string;
  audio?: string;
};
const DEMO_STEPS: ExampleStep[] = [
  {
    label: "Capture a reading",
    text: "At one kilohertz, output one point seven volts",
    detail:
      "The speech transcript becomes a proposed reading. Nothing is saved yet.",
  },
  {
    label: "Correct one value",
    text: "Correct output to one point six eight volts",
    detail:
      "The output changes, and the original transcript stays in the history.",
  },
  {
    label: "Confirm it",
    text: "Save reading",
    detail: "Only a confirmed reading enters the notebook and the plot.",
  },
  {
    label: "Keep the observation",
    text: "Note: the output trace looks slightly noisy",
    detail: "Observations are kept separately from numerical measurements.",
  },
  {
    label: "Handle a missing unit",
    text: "At two thousand, output one point two four volts",
    detail: "No guessing: the frequency needs a unit before this can be saved.",
  },
  {
    label: "Repeat with the unit",
    text: "At two kilohertz, output one point two four volts",
    detail:
      "The ambiguous phrase was rejected. Repeat the complete reading with units, then confirm it.",
  },
  {
    label: "Save the next reading",
    text: "Save reading",
    detail: "The plot now contains both confirmed sample readings.",
  },
  {
    label: "Read a useful summary",
    text: "Summarise the session",
    detail:
      "A short summary comes from the saved numbers, not an invented explanation.",
  },
];
const INVESTIGATION_STEPS: ExampleStep[] = [
  {
    label: "Start with a surprising reading",
    text: "At ten kilohertz, output thirty one millivolts",
    audio: "investigation-anchor.wav",
    detail:
      "Synthetic example: 31 mV is much smaller than the configured circuit predicts. Transcribe the audio through real Whisper, or run the phrase as text.",
  },
  {
    label: "Confirm the observation",
    text: "Save reading",
    detail:
      "Keep what was observed. A theory must never silently change the recorded value.",
  },
  {
    label: "Ask a better experimental question",
    text: "What would tell these apart?",
    audio: "investigation-question.wav",
    detail:
      "Two models are fitted to that one observation. Benchlog commits to their predictions for a new test before seeing its result.",
  },
  {
    label: "Take the proposed measurement",
    text: "At eighty hertz, output one point seven eight volts",
    audio: "investigation-result.wav",
    detail:
      "This is another synthetic reading, chosen to demonstrate a changed time constant. In a real experiment, set the proposed frequency and read your instrument.",
  },
  {
    label: "Compare against the frozen predictions",
    text: "Save reading",
    detail:
      "The comparison uses the earlier predictions. Neither model is refitted to make this result look better.",
  },
  {
    label: "Explain what the evidence means",
    text: "Review the investigation",
    detail:
      "A closer match supports one of these two models. It does not prove which component or instrument setting caused the result.",
  },
];
function investigationExample() {
  const s = createSession();
  return {
    ...s,
    config: { ...s.config, title: "Two explanations · example" },
    reply:
      "This synthetic investigation starts with an unexpectedly small reading. Capture it, then ask which test would distinguish two possible explanations.",
  };
}
function example() {
  let s = createSession();
  s = {
    ...s,
    config: { ...s.config, title: "RC low-pass · example notebook" },
  };
  for (const [f, v] of [
    [100, 1.99],
    [300, 1.96],
    [5000, 0.61],
    [10000, 0.31],
  ]) {
    s = handleUtterance(s, `At ${f} hertz, output ${v} volts`, "demo");
    s = handleUtterance(s, "save reading", "demo");
  }
  return {
    ...s,
    reply:
      "This is a synthetic example. Walk through a reading, a correction and a confirmation below.",
  };
}

export default function App() {
  const [initial] = useState(() => loadSession());
  const [live, setLive] = useState<Session>(initial.session),
    [demoSession, setDemoSession] = useState<Session>(() => example());
  const [demo, setDemo] = useState(false),
    [step, setStep] = useState(0),
    [typed, setTyped] = useState(""),
    [transcript, setTranscript] = useState("");
  const [demoKind, setDemoKind] = useState<"sweep" | "investigation">("sweep");
  const steps = demoKind === "investigation" ? INVESTIGATION_STEPS : DEMO_STEPS;
  const [status, setStatus] = useState<VoiceStatus>("idle"),
    [interim, setInterim] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(initial.error);
  const [modal, setModal] = useState<"help" | "setup" | "voice" | null>(null),
    [readback, setReadback] = useState(true),
    [voiceMode, setVoiceMode] = useState<"browser" | "local">("browser");
  const [capture, setCapture] = useState(false),
    [tab, setTab] = useState<"readings" | "notes">("readings"),
    [exportOpen, setExportOpen] = useState(false),
    [localBusy, setLocalBusy] = useState(false);
  const session = demo ? demoSession : live;
  const sessionRef = useRef(session),
    demoRef = useRef(demo),
    voiceRef = useRef<BrowserVoice | LocalVoice | null>(null),
    readbackRef = useRef(readback);
  sessionRef.current = session;
  demoRef.current = demo;
  readbackRef.current = readback;
  const processRef = useRef<(text: string, source: Source) => void>(() => {});
  const localClip = useRef<LocalSpeech | null>(null),
    operation = useRef(0),
    captureRef = useRef(capture);
  captureRef.current = capture;
  processRef.current = (text, source) => {
    const next = handleUtterance(
      sessionRef.current,
      text,
      demoRef.current ? "demo" : source,
    );
    sessionRef.current = next;
    (demoRef.current ? setDemoSession : setLive)(next);
    setTranscript(text);
    setError("");
    if (source === "voice" || captureRef.current)
      voiceRef.current?.speak(next.reply);
  };
  useEffect(() => {
    if (!storageError) {
      try {
        saveSession(live);
      } catch {
        setStorageError(
          "This browser could not save your notebook. Export it before closing this page.",
        );
      }
    }
  }, [live, storageError]);
  useEffect(() => {
    const hidden = () => {
      // Live capture/readback should not continue out of sight. An explicitly
      // selected audio file has no live microphone and can finish in the background.
      if (document.hidden) stopLiveVoice();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      operation.current++;
      document.removeEventListener("visibilitychange", hidden);
      voiceRef.current?.dispose();
      localClip.current?.dispose();
    };
  }, []);
  const process = (text: string, source: Source = "typed") =>
    processRef.current(text, source);
  function stopLiveVoice() {
    const hadLiveController = voiceRef.current !== null;
    voiceRef.current?.dispose();
    voiceRef.current = null;
    captureRef.current = false;
    setCapture(false);
    setStatus("idle");
    if (hadLiveController) setInterim("");
  }
  function stopVoice() {
    operation.current++;
    localClip.current?.dispose();
    localClip.current = null;
    stopLiveVoice();
    setInterim("");
    setLocalBusy(false);
  }
  function startVoice() {
    stopVoice();
    setError("");
    setModal(null);
    const callbacks = {
      onTranscript: (text: string) => processRef.current(text, "voice"),
      onInterim: setInterim,
      onStatus: (value: VoiceStatus) => {
        setStatus(value);
        if (value === "error") setCapture(false);
      },
      onError: (message: string) => setError(message),
    };
    const controller =
      voiceMode === "local"
        ? new LocalVoice(callbacks)
        : new BrowserVoice(callbacks);
    controller.setReadback(readbackRef.current);
    voiceRef.current = controller;
    setCapture(true);
    controller.start();
  }
  function toggleDemo() {
    stopVoice();
    if (!demo && demoKind !== "sweep") {
      setDemoKind("sweep");
      setDemoSession(example());
      setStep(0);
    }
    setDemo((v) => !v);
    setTranscript("");
    setError("");
    setTyped("");
  }
  function resetDemo() {
    stopVoice();
    setDemoSession(
      demoKind === "investigation" ? investigationExample() : example(),
    );
    setStep(0);
    setTranscript("");
  }
  function startInvestigationExample() {
    stopVoice();
    const fresh = investigationExample();
    setDemoKind("investigation");
    setDemo(true);
    demoRef.current = true;
    setDemoSession(fresh);
    sessionRef.current = fresh;
    setStep(0);
    setTranscript("");
    setError("");
    setTyped("");
  }
  async function transcribeExampleStep(filename: string) {
    stopVoice();
    const op = operation.current;
    setLocalBusy(true);
    setInterim("Loading the example audio…");
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}examples/${filename}`,
      );
      if (!response.ok)
        throw new Error("The example audio could not be loaded.");
      const blob = await response.blob();
      if (op !== operation.current) return;
      const before = sessionRef.current;
      const succeeded = await transcribeClip(
        new File([blob], filename, { type: "audio/wav" }),
        op,
      );
      if (succeeded && op === operation.current) {
        const after = sessionRef.current;
        // Recognition alone is not completion: keep the real engine reply and
        // let the user retry if the words did not produce this step's action.
        const completed =
          filename === "investigation-question.wav"
            ? Boolean(
                after.investigation &&
                after.investigation.id !== before.investigation?.id,
              )
            : Boolean(
                after.pending &&
                after.pending !== before.pending &&
                after.pending.frequencyHz !== undefined &&
                after.pending.outputVpp !== undefined,
              );
        if (completed) setStep((s) => s + 1);
      }
    } catch (error) {
      if (op === operation.current)
        setError(
          error instanceof Error
            ? error.message
            : "The audio could not be transcribed.",
        );
    } finally {
      if (op === operation.current) {
        setLocalBusy(false);
        setInterim("");
      }
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (typed.trim()) {
      process(typed);
      setTyped("");
    }
  }
  function exportFile(kind: "csv" | "md" | "json") {
    const filename = `benchlog-${demo ? "example-" : ""}${new Date().toISOString().slice(0, 10)}`;
    const note = demo
      ? "SYNTHETIC DEMONSTRATION DATA. Not physical measurements.\n\n"
      : "";
    if (kind === "json")
      download(
        JSON.stringify({ version: 1, demonstration: demo, session }, null, 2),
        filename + ".json",
        "application/json",
      );
    if (kind === "csv")
      download(
        (demo
          ? "# Synthetic demonstration data, not physical measurements\r\n"
          : "") + toCsv(session),
        filename + ".csv",
        "text/csv;charset=utf-8",
      );
    if (kind === "md")
      download(
        note + toMarkdown(session),
        filename + ".md",
        "text/markdown;charset=utf-8",
      );
    setExportOpen(false);
  }
  async function transcribeClip(file: File, existingOperation?: number) {
    if (existingOperation === undefined) stopVoice();
    const currentOperation = existingOperation ?? operation.current;
    if (currentOperation !== operation.current) return;
    setLocalBusy(true);
    setError("");
    try {
      localClip.current ??= new LocalSpeech((text) => {
        if (operation.current === currentOperation) setInterim(text);
      });
      const text = await localClip.current.transcribe(file);
      if (currentOperation !== operation.current) return;
      if (!text) throw new Error("No words were recognised in that clip.");
      process(text, "voice");
      return true;
    } catch (e) {
      if (currentOperation !== operation.current) return;
      setError(
        e instanceof Error ? e.message : "The clip could not be transcribed.",
      );
      return false;
    } finally {
      if (currentOperation === operation.current) {
        setLocalBusy(false);
        setInterim("");
      }
    }
  }
  async function trySample() {
    stopVoice();
    setDemoKind("sweep");
    setDemo(true);
    demoRef.current = true;
    const fresh = example();
    setDemoSession(fresh);
    sessionRef.current = fresh;
    setStep(1);
    setModal(null);
    const sampleOperation = operation.current;
    setLocalBusy(true);
    setError("");
    setInterim("Loading the sample recording…");
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}examples/reading.wav`,
      );
      if (!response.ok)
        throw new Error("The sample recording could not be loaded.");
      const blob = await response.blob();
      if (operation.current !== sampleOperation) return;
      const succeeded = await transcribeClip(
        new File([blob], "synthetic-reading.wav", { type: "audio/wav" }),
        sampleOperation,
      );
      if (operation.current === sampleOperation && succeeded === false)
        setStep(0);
    } catch (e) {
      if (operation.current === sampleOperation) {
        setStep(0);
        setError(
          e instanceof Error ? e.message : "The sample could not be loaded.",
        );
      }
    } finally {
      if (operation.current === sampleOperation) {
        setLocalBusy(false);
        setInterim("");
      }
    }
  }
  const latest = session.measurements.at(-1),
    pending = session.pending;
  const statusLabel = localBusy
    ? "Transcribing audio"
    : {
        idle: "Ready when you are",
        listening: "Listening",
        thinking: "Working on this device",
        speaking: "Reading it back",
        error: "Voice needs attention",
      }[status];

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to notebook
      </a>
      <header className="masthead">
        <a className="brand" href="#workspace" aria-label="Benchlog home">
          <svg viewBox="0 0 48 32" aria-hidden="true">
            <path d="M2 16h9V5h10v22h9V16h13" />
            <circle cx="43" cy="16" r="3" />
          </svg>
          <span>
            benchlog<span className="brand-period">.</span>
          </span>
        </a>
        <span className="brand-caption">A voice notebook for the bench</span>
        <nav aria-label="Notebook tools">
          <button className="quiet" onClick={() => setModal("help")}>
            <Icon name="help" />
            <span>How it works</span>
          </button>
          <a
            className="quiet github"
            href="https://github.com/talayahya/Benchlog"
            target="_blank"
            rel="noreferrer"
          >
            Source code
          </a>
        </nav>
      </header>
      <main id="workspace" className="workspace">
        <aside className="experiment">
          <p className="eyebrow">The experiment</p>
          <h1>
            Keep your hands <br />
            on the circuit.
          </h1>
          <p className="intro">
            Read the instrument aloud. <br />
            Test what it could mean.
          </p>
          <div className="circuit-label">
            <span>RC low-pass filter</span>
            <span className="small-label">Sine wave</span>
          </div>
          <Schematic />
          <dl className="config-values">
            <div>
              <dt>Resistance</dt>
              <dd>
                {Number((session.config.resistanceOhm / 1000).toPrecision(5))}
                <span>kΩ</span>
              </dd>
            </div>
            <div>
              <dt>Capacitance</dt>
              <dd>
                {Number((session.config.capacitanceF * 1e9).toPrecision(5))}
                <span>nF</span>
              </dd>
            </div>
            <div>
              <dt>Input amplitude</dt>
              <dd>
                {session.config.inputVpp}
                <span>Vpp</span>
              </dd>
            </div>
          </dl>
          <div className="cutoff">
            <span>Calculated cutoff</span>
            <strong>{formatFrequency(cutoffHz(session.config))}</strong>
            <span className="formula">
              f<sub>c</sub> = 1 / (2πRC)
            </span>
          </div>
          <p className="model-note">
            Ideal, unloaded RC model. All voltages use peak-to-peak amplitude.
            Readings come from you, not an instrument connection.
          </p>
          <button
            className="secondary full"
            onClick={() => {
              stopVoice();
              setModal("setup");
            }}
            disabled={demo}
          >
            <Icon name="plus" />
            {live.measurements.length || live.notes.length
              ? "New experiment"
              : "Set up experiment"}
          </button>
          <div className="sidebar-bottom">
            <p>
              <Icon name="book" />
              <span>Your notebook stays in this browser.</span>
            </p>
            <p>
              Export it to keep a separate copy. No account, analytics or API
              key.
            </p>
          </div>
        </aside>

        <section className="notebook" aria-label="Experiment notebook">
          <div className="notebook-heading">
            <div>
              <p className="eyebrow">
                {demo ? "Guided example · synthetic data" : "Your notebook"}
              </p>
              <h2>{session.config.title}</h2>
            </div>
            <div className="notebook-actions">
              {!demo && (
                <button className="primary" onClick={startInvestigationExample}>
                  Try investigation
                </button>
              )}
              <button
                className={demo ? "secondary selected" : "secondary"}
                onClick={toggleDemo}
              >
                <Icon name={demo ? "book" : "play"} />
                {demo ? "My notebook" : "Try example"}
              </button>
              <div className="export-control">
                <button
                  className="secondary"
                  onClick={() => setExportOpen((v) => !v)}
                  aria-expanded={exportOpen}
                >
                  <Icon name="download" />
                  Export
                </button>
                {exportOpen && (
                  <div className="export-menu">
                    <button onClick={() => exportFile("csv")}>
                      Readings as CSV
                    </button>
                    <button onClick={() => exportFile("md")}>
                      Full report as Markdown
                    </button>
                    <button onClick={() => exportFile("json")}>
                      Full record as JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {storageError && (
            <div className="notice warning" role="alert">
              {storageError}
            </div>
          )}
          {demo && (
            <div className="demo-banner">
              <div>
                <strong>Example notebook</strong>
                <span>
                  These values are synthetic, not results from a physical
                  circuit. Your own notebook is kept separately.
                </span>
              </div>
              <button className="text-button" onClick={resetDemo}>
                Restart example
              </button>
            </div>
          )}
          <div className="capture-grid">
            <section
              className={`voice-panel ${capture ? "is-active" : ""}`}
              aria-labelledby="voice-title"
            >
              <div className="panel-top">
                <span className="eyebrow light" id="voice-title">
                  Capture a reading
                </span>
                <span className="voice-state">
                  <span className={`state-light ${capture ? "active" : ""}`} />
                  {statusLabel}
                </span>
              </div>
              <div className="reply" role="status" aria-live="polite">
                {session.reply}
              </div>
              {interim && (
                <p className="interim" aria-live="off">
                  {interim}
                </p>
              )}
              {pending && (
                <div className="pending-reading">
                  <div>
                    <span>Frequency</span>
                    <strong>
                      {pending.frequencyHz === undefined
                        ? "Needs unit / value"
                        : formatFrequency(pending.frequencyHz)}
                    </strong>
                  </div>
                  <div>
                    <span>Output</span>
                    <strong>
                      {pending.outputVpp === undefined
                        ? "Needs unit / value"
                        : formatVoltage(pending.outputVpp)}
                    </strong>
                  </div>
                  {pending.phaseDeg !== undefined && (
                    <div>
                      <span>Phase</span>
                      <strong>{pending.phaseDeg}°</strong>
                    </div>
                  )}
                </div>
              )}
              {transcript && (
                <details className="heard">
                  <summary>
                    What {demo ? "the example said" : "I heard"}
                  </summary>
                  <p>“{transcript}”</p>
                </details>
              )}
              {error && (
                <div className="voice-error" role="alert">
                  {error}
                </div>
              )}
              <div className="voice-controls">
                <button
                  className={`record ${capture ? "record-stop" : ""}`}
                  onClick={() =>
                    capture || localBusy ? stopVoice() : setModal("voice")
                  }
                >
                  <Icon name={capture ? "stop" : "mic"} size={23} />
                  {localBusy
                    ? "Cancel transcription"
                    : capture
                      ? "Stop session"
                      : "Start voice session"}
                </button>
                <label className="readback">
                  <input
                    type="checkbox"
                    checked={readback}
                    onChange={(e) => {
                      setReadback(e.target.checked);
                      voiceRef.current?.setReadback(e.target.checked);
                    }}
                  />
                  <Icon name="sound" size={17} />
                  <span>Read back</span>
                </label>
              </div>
              {pending && (
                <div className="confirm-actions">
                  <button
                    className="save-reading"
                    onClick={() => process("save reading")}
                  >
                    <Icon name="check" />
                    Save reading
                  </button>
                  <button
                    className="discard"
                    onClick={() => process("discard reading")}
                  >
                    Discard
                  </button>
                  <span>Or say “save reading”.</span>
                </div>
              )}
              <form className="type-form" onSubmit={submit}>
                <label htmlFor="utterance">Or type what you would say</label>
                <div>
                  <input
                    id="utterance"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="At 1 kilohertz, output 1.68 volts"
                    maxLength={1000}
                    autoComplete="off"
                  />
                  <button
                    aria-label="Process typed phrase"
                    type="submit"
                    disabled={!typed.trim()}
                  >
                    Use phrase
                  </button>
                </div>
              </form>
            </section>
            <section className="response-panel" aria-labelledby="plot-title">
              <div className="section-title">
                <div>
                  <h3 id="plot-title">Frequency response</h3>
                </div>
                <span className="count-label">
                  {session.measurements.length} saved
                </span>
              </div>
              <Plot session={session} demo={demo} />
              <div className="latest-reading">
                {latest ? (
                  <>
                    <span>Last confirmed</span>
                    <strong>{formatFrequency(latest.frequencyHz)}</strong>
                    <strong>{formatVoltage(latest.outputVpp)}</strong>
                    <span className="gain">
                      {latest.outputVpp
                        ? measuredGainDb(latest, session.config).toFixed(2) +
                          " dB"
                        : "−∞ dB (zero output)"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="empty-symbol">+</span>
                    <p>
                      A measurement becomes a point
                      <br />
                      when you confirm it.
                    </p>
                  </>
                )}
              </div>
            </section>
          </div>
          {demo ? (
            <section className="walkthrough" aria-label="Guided example">
              <div className="walkthrough-heading">
                <span className="step-number">
                  {Math.min(step + 1, steps.length)} / {steps.length}
                </span>
                <div>
                  <h3>
                    {step < steps.length
                      ? steps[step].label
                      : "That is the whole loop."}
                  </h3>
                  <p>
                    {step < steps.length
                      ? steps[step].detail
                      : "Try your own phrasing, inspect a reading’s history, or return to your notebook."}
                  </p>
                </div>
              </div>
              {step < steps.length && (
                <div className="demo-phrase">
                  <q>{steps[step].text}</q>
                  {steps[step].audio && (
                    <button
                      className="secondary"
                      disabled={localBusy}
                      onClick={() =>
                        void transcribeExampleStep(steps[step].audio!)
                      }
                    >
                      Transcribe example audio
                    </button>
                  )}
                  <button
                    className="primary"
                    disabled={localBusy}
                    onClick={() => {
                      process(steps[step].text, "demo");
                      setStep((s) => s + 1);
                    }}
                  >
                    <Icon name="play" />
                    Run this phrase
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section
              className="phrase-strip"
              aria-label="Voice command examples"
            >
              <span>Try saying</span>
              <button
                onClick={() =>
                  setTyped("At one kilohertz, output one point six eight volts")
                }
              >
                “At one kilohertz, output one point six eight volts”
              </button>
              <button onClick={() => setTyped("Note: the trace looks noisy")}>
                “Note: the trace looks noisy”
              </button>
              <button onClick={() => setTyped("Suggest the next frequency")}>
                “Suggest the next frequency”
              </button>
            </section>
          )}
          <Investigation
            session={session}
            onCommand={(text) => process(text)}
          />
          <section className="ledger" aria-label="Saved notebook">
            <div className="ledger-header">
              <div
                className="tabs"
                role="tablist"
                aria-label="Notebook sections"
              >
                <button
                  role="tab"
                  aria-selected={tab === "readings"}
                  onClick={() => setTab("readings")}
                >
                  Readings <span>{session.measurements.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "notes"}
                  onClick={() => setTab("notes")}
                >
                  Observations <span>{session.notes.length}</span>
                </button>
              </div>
              <button
                className="quiet"
                onClick={() => process("undo last reading")}
                disabled={!session.measurements.length}
              >
                <Icon name="undo" size={17} />
                Undo last reading
              </button>
            </div>
            {tab === "readings" ? (
              session.measurements.length ? (
                <div className="table-scroll" role="tabpanel">
                  <table>
                    <caption className="sr-only">
                      {demo ? "Synthetic example" : "Confirmed"} readings.
                      Output and input use peak-to-peak amplitude.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Reading</th>
                        <th scope="col">Frequency</th>
                        <th scope="col">
                          Output <span>Vpp</span>
                        </th>
                        <th scope="col">
                          Gain <span>dB</span>
                        </th>
                        <th scope="col">Phase</th>
                        <th scope="col">Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.measurements.map((m, i) => (
                        <tr key={m.id}>
                          <td className="row-number">
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="numeric">
                            {formatFrequency(m.frequencyHz)}
                          </td>
                          <td className="numeric">
                            {Number(m.outputVpp.toPrecision(6))}
                          </td>
                          <td className="numeric">
                            {m.outputVpp > 0
                              ? measuredGainDb(m, session.config).toFixed(2)
                              : "−∞"}
                          </td>
                          <td className="numeric">
                            {m.phaseDeg === undefined
                              ? "Not recorded"
                              : `${m.phaseDeg}°`}
                          </td>
                          <td>
                            <details className="record-history">
                              <summary>
                                {m.source === "demo"
                                  ? "Example"
                                  : m.source === "voice"
                                    ? "Voice"
                                    : "Typed"}{" "}
                                · details
                              </summary>
                              <div>
                                <time dateTime={m.createdAt}>
                                  {new Date(m.createdAt).toLocaleString(
                                    "en-GB",
                                  )}
                                </time>
                                <p>{m.transcript}</p>
                                {m.history.length > 0 && (
                                  <ol>
                                    {m.history.map((entry, j) => (
                                      <li key={j}>{entry}</li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-ledger" role="tabpanel">
                  <Icon name="book" size={29} />
                  <div>
                    <h3>A clear record starts with one reading.</h3>
                    <p>
                      Tell Benchlog the frequency and output voltage, then
                      confirm what it heard.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="notes-list" role="tabpanel">
                {session.notes.length ? (
                  session.notes.map((n) => (
                    <article key={n.id}>
                      <Icon name="file" />
                      <div>
                        <p>{n.text}</p>
                        <span>
                          {n.source === "demo"
                            ? "Example observation"
                            : new Date(n.createdAt).toLocaleTimeString(
                                "en-GB",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-ledger">
                    <Icon name="file" size={29} />
                    <div>
                      <h3>Keep the details the numbers miss.</h3>
                      <p>
                        Say “note” followed by an observation, such as “the
                        trace looks noisy”.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          <footer className="workspace-footer">
            <span>Built around the bench, by Tala Yahya.</span>
            <span>Hiya Voice AI Challenge · Productivity</span>
          </footer>
        </section>
      </main>

      {modal === "voice" && (
        <Dialog title="Choose how to listen" onClose={() => setModal(null)}>
          <p>
            Start a session, then say a reading, a correction, or “save
            reading”. The microphone pauses during spoken replies. Use Stop
            session when you are finished.
          </p>
          <fieldset className="voice-options">
            <legend>Speech recognition</legend>
            <label
              className={voiceMode === "browser" ? "option selected" : "option"}
            >
              <input
                type="radio"
                name="voice-mode"
                checked={voiceMode === "browser"}
                onChange={() => setVoiceMode("browser")}
              />
              <span>
                <strong>Browser speech</strong>
                <span>
                  Fast, hands-free turns. Your browser may send audio to its
                  speech provider. Requires a supported browser and usually a
                  connection.
                </span>
                {!BrowserVoice.supported() && (
                  <b>Not available in this browser. Choose local speech.</b>
                )}
              </span>
            </label>
            <label
              className={voiceMode === "local" ? "option selected" : "option"}
            >
              <input
                type="radio"
                name="voice-mode"
                checked={voiceMode === "local"}
                onChange={() => setVoiceMode("local")}
              />
              <span>
                <strong>On-device Whisper</strong>
                <span>
                  Audio stays on this device. Downloads a speech model on first
                  use, then runs in your browser. Pause for about a second
                  between phrases. Slower on some laptops.
                </span>
              </span>
            </label>
          </fieldset>
          <p className="small-note">
            No audio is stored by Benchlog. Confirmed transcripts and notes stay
            in this browser. English speech only in this prototype.
          </p>
          <button
            className="primary full"
            onClick={startVoice}
            disabled={voiceMode === "browser" && !BrowserVoice.supported()}
          >
            <Icon name="mic" />
            Start listening
          </button>
        </Dialog>
      )}
      {modal === "setup" && (
        <Setup
          initial={live.config}
          hasData={!!(live.measurements.length || live.notes.length)}
          onClose={() => setModal(null)}
          onSave={(config) => {
            setLive(createSession(config));
            setStorageError(null);
            setTranscript("");
            setError("");
            setModal(null);
          }}
        />
      )}
      {modal === "help" && (
        <Dialog
          title="A small assistant for a busy bench"
          onClose={() => setModal(null)}
        >
          <p>
            Benchlog turns a spoken reading into a record you can inspect. It
            does not operate your oscilloscope, measure your circuit or decide
            whether your wiring is safe.
          </p>
          <div className="help-steps">
            <div>
              <strong>Set the context once</strong>
              <p>
                Enter your resistor, capacitor and input amplitude. Keep the
                input fixed during a sweep. All amplitudes are peak-to-peak.
              </p>
            </div>
            <div>
              <strong>Speak, check, confirm</strong>
              <p>
                “At one kilohertz, output one point six eight volts.” Check the
                read-back, then say “save reading”. To fix it: “correct output
                to one point six volts”.
              </p>
            </div>
            <div>
              <strong>Leave a trail</strong>
              <p>
                “Note: the trace looks noisy.” Or “undo last reading”, “read
                back the last reading”, “summarise the session”, and “suggest
                the next frequency”. Original phrases and corrections remain
                with each saved reading.
              </p>
            </div>
          </div>
          <p>
            Speech recognition uses AI. A small, tested parser checks commands
            and units. It will ask for missing units and reject RMS or peak-only
            readings, rather than mix amplitude conventions.
          </p>
          <p>
            The dashed plot is the ideal unloaded RC calculation. Confirmed
            readings are shown as separate points. The model omits probe
            loading, source impedance and component tolerance.
          </p>
          <div className="audio-import">
            <h3>Try real speech recognition</h3>
            <p>
              Use this synthetic voice sample to test the actual Whisper model.
              It opens a separate example notebook and needs no microphone.
            </p>
            <audio
              controls
              preload="none"
              src={`${import.meta.env.BASE_URL}examples/reading.wav`}
              aria-label="Synthetic speech sample: at one kilohertz, output one point seven volts"
            />
            <button
              className="secondary full sample-button"
              onClick={() => void trySample()}
              disabled={localBusy}
            >
              Transcribe the sample on this device
            </button>
            <h3>Or use your own short clip</h3>
            <p>
              WAV, MP3 or another format your browser supports. Up to 30 seconds
              / 10 MB. The first use downloads Whisper; your audio is processed
              here.
            </p>
            <label className="secondary upload-label">
              <Icon name="file" />
              Choose audio clip
              <input
                type="file"
                accept="audio/*"
                disabled={localBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setModal(null);
                    void transcribeClip(file);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="small-note">
            All app fonts are self-hosted. Your notebook is stored on this
            device. Export regularly; clearing browser data removes the local
            copy.
          </p>
        </Dialog>
      )}
    </>
  );
}

function Setup({
  initial,
  hasData,
  onClose,
  onSave,
}: {
  initial: Config;
  hasData: boolean;
  onClose: () => void;
  onSave: (config: Config) => void;
}) {
  const [title, setTitle] = useState(initial.title),
    [r, setR] = useState(String(initial.resistanceOhm / 1000)),
    [c, setC] = useState(String(initial.capacitanceF * 1e9)),
    [vin, setVin] = useState(String(initial.inputVpp)),
    [errors, setErrors] = useState<string[]>([]);
  return (
    <Dialog
      title={hasData ? "Start a new experiment" : "Set up your experiment"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const config = {
            title: title.trim(),
            resistanceOhm: Number(r) * 1000,
            capacitanceF: Number(c) * 1e-9,
            inputVpp: Number(vin),
          };
          const issues = validateConfig(config);
          setErrors(issues);
          if (!issues.length) onSave(config);
        }}
      >
        <p>
          A sine-wave frequency sweep through a simple RC low-pass filter. Keep
          the input amplitude fixed for this notebook.
        </p>
        <label className="form-field">
          Notebook title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <div className="setup-fields">
          <label className="form-field">
            Resistance (kΩ)
            <input
              type="number"
              min="0.000001"
              step="any"
              value={r}
              onChange={(e) => setR(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            Capacitance (nF)
            <input
              type="number"
              min="0.000001"
              step="any"
              value={c}
              onChange={(e) => setC(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            Input (Vpp)
            <input
              type="number"
              min="0.000001"
              step="any"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              required
            />
          </label>
        </div>
        {hasData && (
          <div className="notice warning">
            This starts a fresh notebook. Export your current readings first if
            you want to keep them.
          </div>
        )}
        {errors.length > 0 && (
          <ul role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button className="primary full" type="submit">
          {hasData ? "Start new notebook" : "Save experiment setup"}
        </button>
      </form>
    </Dialog>
  );
}
