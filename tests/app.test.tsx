// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createSession } from "../src/engine";
import { download } from "../src/storage";

const clip = vi.hoisted(() => ({
  resolve: null as null | ((text: string) => void),
}));
vi.mock("../src/localSpeech", () => ({
  LocalSpeech: class {
    load() {
      return Promise.resolve("");
    }
    transcribe() {
      return new Promise<string>((resolve) => {
        clip.resolve = resolve;
      });
    }
    dispose() {}
  },
}));
vi.mock("../src/storage", async (original) => ({
  ...(await original<typeof import("../src/storage")>()),
  download: vi.fn(),
}));

const KEY = "benchlog.notebook.v1";
const notebook = () => JSON.parse(localStorage.getItem(KEY)!).session;
async function say(text: string) {
  const user = userEvent.setup();
  // These workflows exercise phrase submission, not individual keystrokes.
  // Pasting avoids hundreds of full notebook rerenders under parallel CI load.
  await user.click(screen.getByLabelText("Or type what you would say"));
  await user.paste(text);
  await user.click(
    screen.getByRole("button", { name: "Process typed phrase" }),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  clip.resolve = null;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("real notebook workflows", () => {
  it("keeps a dictated value out of the saved ledger until corrected and confirmed", async () => {
    render(<App />);
    await say("At one kilohertz, output one point seven volts");
    expect(notebook().measurements).toHaveLength(0);
    await say("Correct output to one point six eight volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    expect(notebook().measurements).toHaveLength(1);
    expect(notebook().measurements[0]).toMatchObject({
      frequencyHz: 1000,
      outputVpp: 1.68,
      source: "typed",
    });
    expect(notebook().measurements[0].history).toEqual([
      "Correct output to one point six eight volts",
    ]);
    expect(screen.queryByRole("button", { name: "Save reading" })).toBeNull();
  });

  it("completes every advertised guided-example step, including rejected-unit recovery", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Try example" }));
    for (let index = 0; index < 8; index++)
      await userEvent.click(
        screen.getByRole("button", { name: "Run this phrase" }),
      );
    expect(screen.getByRole("tab", { name: "Readings 6" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Observations 1" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "6 confirmed readings",
    );
    expect(screen.queryByRole("button", { name: "Save reading" })).toBeNull();
    expect(notebook().measurements).toHaveLength(0);
  });

  it("runs the investigation example against predictions frozen before the confirmed test", async () => {
    const user = userEvent.setup();
    render(<App />);
    const liveBefore = notebook();
    await user.click(screen.getByRole("button", { name: "Try investigation" }));
    const runPhrase = () =>
      user.click(screen.getByRole("button", { name: "Run this phrase" }));
    const exportRecord = async () => {
      await user.click(screen.getByRole("button", { name: "Export" }));
      await user.click(
        screen.getByRole("button", { name: "Full record as JSON" }),
      );
      return JSON.parse(vi.mocked(download).mock.calls.at(-1)![0]);
    };

    await runPhrase(); // Anchor is still unconfirmed.
    expect(screen.getByRole("tab", { name: "Readings 0" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Compare explanations" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await runPhrase(); // Save the 10 kHz, 31 mV observation.
    expect(screen.getByRole("tab", { name: "Readings 1" })).toBeTruthy();
    await runPhrase(); // Commit to a prospective test.
    const investigation = screen.getByRole("region", {
      name: "What would tell them apart?",
    });
    expect(
      within(investigation).getByText("Waiting for the test"),
    ).toBeTruthy();
    expect(within(investigation).getByText("80 Hz")).toBeTruthy();
    const beforeTest = await exportRecord();
    expect(beforeTest.demonstration).toBe(true);
    const receipt = beforeTest.session.investigation;
    expect(receipt.anchor).toMatchObject({
      frequencyHz: 10000,
      outputVpp: 0.031,
      source: "demo",
    });
    expect(receipt.targetFrequencyHz).toBe(80);
    expect(receipt.predictions.changedTimeConstantVpp).toBeCloseTo(
      1.7772862243780279,
      10,
    );
    expect(receipt.predictions.frequencyIndependentScaleVpp).toBeCloseTo(
      0.19698152745867004,
      10,
    );

    await runPhrase(); // A proposed test value must not produce a result yet.
    expect(screen.getByRole("tab", { name: "Readings 1" })).toBeTruthy();
    expect(
      within(investigation).getByText("Waiting for the test"),
    ).toBeTruthy();
    expect(
      within(investigation).queryByText("Confirmed observation"),
    ).toBeNull();
    await runPhrase(); // Save the 80 Hz, 1.78 Vpp test.
    expect(screen.getByRole("tab", { name: "Readings 2" })).toBeTruthy();
    expect(
      within(investigation).getByText("Within the comparison band"),
    ).toBeTruthy();
    expect(
      within(investigation).getByText("Outside the comparison band"),
    ).toBeTruthy();
    await runPhrase(); // Review the evidence, without asserting a hardware cause.
    expect(screen.getByRole("status").textContent).toContain(
      "not a hardware diagnosis",
    );
    expect(
      screen.queryByRole("button", { name: "Run this phrase" }),
    ).toBeNull();
    const afterTest = await exportRecord();
    expect(afterTest.session.investigation).toEqual(receipt);
    expect(afterTest.session.measurements[1]).toMatchObject({
      frequencyHz: 80,
      outputVpp: 1.78,
      source: "demo",
    });
    expect(receipt.existingMeasurementIds).not.toContain(
      afterTest.session.measurements[1].id,
    );

    expect(notebook()).toEqual(liveBefore);
    await user.click(screen.getByRole("button", { name: "My notebook" }));
    expect(notebook()).toEqual(liveBefore);
    expect(screen.getByRole("tab", { name: "Readings 0" })).toBeTruthy();
    expect(screen.queryByText("Waiting for the test")).toBeNull();
  });

  it("advances audio-guided steps only when recognised words produce the expected action", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["dummy"], { type: "audio/wav" }),
      }),
    );
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try investigation" }));
    const transcribe = async (words: string) => {
      clip.resolve = null;
      await user.click(
        screen.getByRole("button", { name: "Transcribe example audio" }),
      );
      await waitFor(() => expect(clip.resolve).not.toBeNull());
      await act(async () => {
        clip.resolve!(words);
      });
    };

    await transcribe("hello");
    expect(
      screen.getByRole("heading", { name: "Start with a surprising reading" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "could not identify a measurement",
    );
    expect(screen.queryByRole("button", { name: "Save reading" })).toBeNull();
    await transcribe("At ten kilohertz"); // A partial reading is not a completed step either.
    expect(
      screen.getByRole("heading", { name: "Start with a surprising reading" }),
    ).toBeTruthy();
    await transcribe("At ten kilohertz, output thirty millivolts");
    expect(
      screen.getByRole("heading", { name: "Confirm the observation" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Run this phrase" }));

    await transcribe("hello");
    expect(
      screen.getByRole("heading", {
        name: "Ask a better experimental question",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Waiting for the test")).toBeNull();
    await transcribe("What would tell these apart?");
    expect(
      screen.getByRole("heading", { name: "Take the proposed measurement" }),
    ).toBeTruthy();
    expect(screen.getByText("Waiting for the test")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(
      screen.getByRole("button", { name: "Full record as JSON" }),
    );
    const record = JSON.parse(vi.mocked(download).mock.calls.at(-1)![0]);
    // Preserve the actually recognised value, not the fixture's advertised 31 mV.
    expect(record.session.investigation.anchor.outputVpp).toBe(0.03);
    expect(record.session.investigation.anchor.transcript).toBe(
      "At ten kilohertz",
    );
    expect(record.session.investigation.anchor.history).toContain(
      "At ten kilohertz, output thirty millivolts",
    );
    expect(record.session.measurements).toHaveLength(1);
    expect(notebook().measurements).toHaveLength(0);
  });

  it("keeps example operations separate and restores the live notebook unchanged", async () => {
    render(<App />);
    await say("At 800 hertz, output 1.8 volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    const before = notebook();
    await userEvent.click(screen.getByRole("button", { name: "Try example" }));
    await say("At 700 hertz, output 1.83 volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    await userEvent.click(screen.getByRole("button", { name: "My notebook" }));
    expect(notebook()).toEqual(before);
    expect(screen.getByRole("tab", { name: "Readings 1" })).toBeTruthy();
    expect(screen.getAllByText("800 Hz").length).toBeGreaterThan(0);
  });

  it("starts a fresh record instead of reinterpreting old measurements under a changed input", async () => {
    render(<App />);
    await say("At 100 hertz output 1.99 volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    await userEvent.click(
      screen.getByRole("button", { name: "New experiment" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Export your current readings first/),
    ).toBeTruthy();
    const input = within(dialog).getByLabelText("Input (Vpp)");
    fireEvent.change(input, { target: { value: "4" } });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Start new notebook" }),
    );
    expect(notebook().config.inputVpp).toBe(4);
    expect(notebook().measurements).toHaveLength(0);
    expect(screen.getByRole("tab", { name: "Readings 0" })).toBeTruthy();
  });

  it("exports a confirmed notebook without including the next unconfirmed draft", async () => {
    render(<App />);
    await say("At 100 hertz output 1.99 volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    await say("At 200 hertz output 1.98 volts");
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Readings as CSV" }),
    );
    const [content, name, type] = vi.mocked(download).mock.calls[0];
    expect(content).toContain("1.99");
    expect(content).not.toContain("1.98");
    expect(name).toMatch(/\.csv$/);
    expect(type).toContain("text/csv");
  });

  it("preserves a corrupt stored record rather than silently replacing it", async () => {
    localStorage.setItem(KEY, "broken-notebook");
    render(<App />);
    expect(screen.getByRole("alert").textContent).toContain(
      "could not be loaded",
    );
    await say("At 100 hertz output 1.99 volts");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    expect(localStorage.getItem(KEY)).toBe("broken-notebook");
  });

  it("discards a pending draft on reload but keeps the confirmed readings", () => {
    const session = createSession();
    session.pending = {
      frequencyHz: 800,
      outputVpp: 1.8,
      source: "voice",
      transcript: "unfinished",
      history: [],
    };
    localStorage.setItem(KEY, JSON.stringify({ version: 1, session }));
    render(<App />);
    expect(screen.queryByRole("button", { name: "Save reading" })).toBeNull();
    expect(notebook().pending).toBeNull();
  });

  it("does not let a delayed example audio transcription leak into the live notebook", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Try example" }));
    await userEvent.click(screen.getByRole("button", { name: "How it works" }));
    const fileInput =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["dummy"], "voice.wav", { type: "audio/wav" })],
      },
    });
    await waitFor(() => expect(clip.resolve).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "My notebook" }));
    await act(async () => {
      clip.resolve!("At 900 hertz output 1.8 volts");
    });
    expect(notebook().pending).toBeNull();
    expect(notebook().measurements).toHaveLength(0);
  });

  it("lets an explicitly uploaded file finish when the tab becomes hidden", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "How it works" }));
    fireEvent.change(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      {
        target: {
          files: [new File(["dummy"], "reading.wav", { type: "audio/wav" })],
        },
      },
    );
    await waitFor(() => expect(clip.resolve).not.toBeNull());
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(
      screen.getByRole("button", { name: "Cancel transcription" }),
    ).toBeTruthy();
    await act(async () => {
      clip.resolve!("At 900 hertz output 1.8 volts");
    });
    expect(notebook().pending).toMatchObject({
      frequencyHz: 900,
      outputVpp: 1.8,
      source: "voice",
    });
    expect(notebook().measurements).toHaveLength(0);
  });

  it("keeps the synthetic sample operation alive across background fetch and inference", async () => {
    let finishFetch!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finishFetch = resolve;
          }),
      ),
    );
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "How it works" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Transcribe the sample on this device",
      }),
    );
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(
      screen.getByRole("button", { name: "Cancel transcription" }),
    ).toBeTruthy();
    await act(async () => {
      finishFetch({
        ok: true,
        blob: async () => new Blob(["dummy"], { type: "audio/wav" }),
      });
    });
    await waitFor(() => expect(clip.resolve).not.toBeNull());
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      clip.resolve!("At one kilohertz output one point seven volts");
    });
    expect(screen.getByRole("button", { name: "Save reading" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "1.7 volts peak-to-peak",
    );
    expect(notebook().pending).toBeNull();
    expect(notebook().measurements).toHaveLength(0);
  });

  it("still stops a live microphone session when the tab becomes hidden", async () => {
    const abort = vi.fn();
    class Recognition {
      onstart: null | (() => void) = null;
      start() {
        this.onstart?.();
      }
      abort = abort;
    }
    vi.stubGlobal("SpeechRecognition", Recognition);
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: "Start voice session" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Start listening" }),
    );
    expect(screen.getByRole("button", { name: "Stop session" })).toBeTruthy();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(abort).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Start voice session" }),
    ).toBeTruthy();
  });
});
