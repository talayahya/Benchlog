import { describe, it, expect } from "vitest";
import { createSession, handleUtterance, toMarkdown } from "../src/engine";
import { isSession } from "../src/storage";

function anchor() {
  let state = createSession();
  state = handleUtterance(
    state,
    "At ten kilohertz, output thirty one millivolts",
    "voice",
  );
  return handleUtterance(state, "Save reading", "voice");
}

describe("spoken investigation workflow", () => {
  it("fits a prospective comparison and evaluates a later observation without rewriting its predictions", () => {
    let state = handleUtterance(
      anchor(),
      "What would tell these apart?",
      "voice",
    );
    const receipt = structuredClone(state.investigation!);
    expect(receipt.targetFrequencyHz).toBe(80);
    expect(state.reply).toContain("predictions are now fixed");
    state = handleUtterance(
      state,
      "At eighty hertz, output one point seven eight volts",
      "voice",
    );
    expect(state.measurements).toHaveLength(1);
    expect(state.investigation).toEqual(receipt);
    state = handleUtterance(state, "Save reading", "voice");
    expect(state.measurements).toHaveLength(2);
    expect(state.investigation).toEqual(receipt);
    expect(toMarkdown(state)).toContain("Prediction receipt");
    expect(toMarkdown(state)).toContain(receipt.anchor.id);
    expect(toMarkdown(state)).toContain("were not refitted");
  });

  it("does not build a theory from an unconfirmed interpretation", () => {
    const pending = handleUtterance(
      createSession(),
      "At 10000 hertz output 0.031 volts",
    );
    const result = handleUtterance(pending, "Compare explanations");
    expect(result.investigation).toBeUndefined();
    expect(result.reply).toContain("Confirm or discard");
  });

  it("requires an explicit new-comparison command before refitting", () => {
    let state = handleUtterance(anchor(), "Compare explanations");
    const first = state.investigation;
    state = handleUtterance(state, "At 80 hertz output 1.78 volts");
    state = handleUtterance(state, "save");
    expect(
      handleUtterance(state, "Compare explanations").investigation,
    ).toEqual(first);
    const next = handleUtterance(state, "New comparison");
    expect(next.investigation?.anchor.id).toBe(state.measurements[1].id);
  });

  it("validates persisted receipts while keeping older notebooks compatible", () => {
    expect(isSession(anchor())).toBe(true);
    const state = handleUtterance(anchor(), "Compare explanations");
    expect(isSession(JSON.parse(JSON.stringify(state)))).toBe(true);
    expect(
      isSession({
        ...state,
        investigation: { ...state.investigation, targetFrequencyHz: null },
      }),
    ).toBe(false);
  });
});
