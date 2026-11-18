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
  await user.type(screen.getByLabelText("Or type what you would say"), text);
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
