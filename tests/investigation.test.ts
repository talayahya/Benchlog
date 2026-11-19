import { describe, it, expect } from "vitest";
import { createSession, type Session, type Measurement } from "../src/engine";
import {
  planInvestigation,
  evaluateInvestigation,
  predictInvestigationVpp,
  isInvestigationPlan,
  type InvestigationPlan,
} from "../src/investigation";

function record(
  id: string,
  frequencyHz: number,
  outputVpp: number,
): Measurement {
  return {
    id,
    frequencyHz,
    outputVpp,
    source: "typed",
    transcript: `at ${frequencyHz} hertz output ${outputVpp} volts`,
    createdAt: "2026-11-19T12:00:00Z",
    history: [],
  };
}
function anchored(): Session {
  return { ...createSession(), measurements: [record("anchor", 2000, 0.16)] };
}
function planFor(s = anchored()): InvestigationPlan {
  const result = planInvestigation(s, {
    id: "plan",
    createdAt: "2026-11-19T12:01:00Z",
  });
  expect(result.state).toBe("ready");
  return result.plan!;
}
function addTest(
  s: Session,
  p: InvestigationPlan,
  output: number,
  id = "heldout",
  frequency = p.targetFrequencyHz,
): Session {
  return {
    ...s,
    measurements: [...s.measurements, record(id, frequency, output)],
  };
}

describe("prospective experiment planning", () => {
  it("requires confirmed positive evidence and ignores pending readings", () => {
    const s = createSession();
    s.pending = {
      frequencyHz: 2000,
      outputVpp: 0.16,
      source: "voice",
      transcript: "pending",
      history: [],
    };
    expect(planInvestigation(s).state).toBe("need-anchor");
  });
  it.each([2, 2.1, 0])(
    "will not fit unsupported anchor amplitude %s Vpp",
    (value) => {
      const s = {
        ...createSession(),
        measurements: [record("anchor", 2000, value)],
      };
      expect(planInvestigation(s).state).toBe("need-anchor");
    },
  );
  it("fits both models to the same latest positive anchor by construction", () => {
    const s = anchored(),
      p = planFor(s);
    expect(
      predictInvestigationVpp(
        s.config.inputVpp,
        p.anchor.frequencyHz,
        p.models.changedTimeConstant.tauSeconds,
      ),
    ).toBeCloseTo(p.anchor.outputVpp, 12);
    expect(
      predictInvestigationVpp(
        s.config.inputVpp,
        p.anchor.frequencyHz,
        p.models.frequencyIndependentScale.tauSeconds,
        p.models.frequencyIndependentScale.scale,
      ),
    ).toBeCloseTo(p.anchor.outputVpp, 12);
    expect(p.sourceIds).toEqual(["anchor"]);
    expect(isInvestigationPlan(p)).toBe(true);
  });
  it("selects the maximum absolute voltage separation on its disclosed grid", () => {
    const p = planFor();
    for (const f of p.candidateFrequenciesHz) {
      const a = predictInvestigationVpp(
        p.config.inputVpp,
        f,
        p.models.changedTimeConstant.tauSeconds,
      );
      const b = predictInvestigationVpp(
        p.config.inputVpp,
        f,
        p.models.frequencyIndependentScale.tauSeconds,
        p.models.frequencyIndependentScale.scale,
      );
      expect(p.separationVpp + 1e-12).toBeGreaterThanOrEqual(Math.abs(a - b));
    }
    expect(p.candidateFrequenciesHz).toContain(p.targetFrequencyHz);
    expect(p.candidateFrequenciesHz.every((f) => f >= 1 && f <= 1e6)).toBe(
      true,
    );
  });
  it("matches an independently calculated prospective fixture", () => {
    const s = {
      ...createSession(),
      measurements: [record("anchor", 10000, 0.031)],
    };
    const p = planFor(s);
    expect(p.models.changedTimeConstant.tauSeconds).toBeCloseTo(
      0.0010266827319736407,
      14,
    );
    expect(p.models.frequencyIndependentScale.scale).toBeCloseTo(
      0.09861510953929359,
      14,
    );
    expect(p.targetFrequencyHz).toBe(80);
    expect(p.predictions.changedTimeConstantVpp).toBeCloseTo(
      1.7772862243780279,
      12,
    );
    expect(p.predictions.frequencyIndependentScaleVpp).toBeCloseTo(
      0.19698152745867004,
      12,
    );
    expect(evaluateInvestigation(addTest(s, p, 1.78), p).state).toBe(
      "changed-time-constant",
    );
  });
  it("excludes frequencies already measured within two percent", () => {
    const initial = planFor(),
      s = anchored();
    // Put the exclusion point before the anchor so the fitted evidence is unchanged.
    s.measurements.unshift(
      record("already", initial.targetFrequencyHz * 1.01, 0.5),
    );
    const p = planFor(s);
    expect(p.targetFrequencyHz).not.toBe(initial.targetFrequencyHz);
    expect(p.existingMeasurementIds).toContain("already");
  });
  it("does not generate a pointless plan when both models are nominally identical", () => {
    const s = createSession(),
      tau = s.config.resistanceOhm * s.config.capacitanceF;
    s.measurements = [
      record(
        "nominal",
        1000,
        predictInvestigationVpp(s.config.inputVpp, 1000, tau),
      ),
    ];
    expect(planInvestigation(s).state).toBe("indistinguishable");
  });
  it("copies anchor, setup, history, and IDs instead of retaining mutable references", () => {
    const s = anchored(),
      p = planFor(s);
    s.config.inputVpp = 3;
    s.measurements[0].outputVpp = 0.2;
    s.measurements[0].history.push("edited");
    expect(p.config.inputVpp).toBe(2);
    expect(p.anchor.outputVpp).toBe(0.16);
    expect(p.anchor.history).toEqual([]);
    expect(p.existingMeasurementIds).toEqual(["anchor"]);
  });
  it("uses the R×C product and cannot distinguish changes to R from reciprocal changes to C", () => {
    const a = anchored(),
      b = anchored();
    b.config.resistanceOhm *= 10;
    b.config.capacitanceF /= 10;
    const pa = planFor(a),
      pb = planFor(b);
    expect(pb.models.frequencyIndependentScale.tauSeconds).toBeCloseTo(
      pa.models.frequencyIndependentScale.tauSeconds,
      12,
    );
    expect(pb.predictions.changedTimeConstantVpp).toBeCloseTo(
      pa.predictions.changedTimeConstantVpp,
      12,
    );
    expect(pb.predictions.frequencyIndependentScaleVpp).toBeCloseTo(
      pa.predictions.frequencyIndependentScaleVpp,
      12,
    );
  });
  it("refuses a grid already covered by confirmed data", () => {
    const s = anchored(),
      initial = planFor(s);
    s.measurements = [
      ...initial.candidateFrequenciesHz.map((f, i) =>
        record(`old-${i}`, f, 0.5),
      ),
      s.measurements[0],
    ];
    expect(planInvestigation(s).state).toBe("no-target");
  });
});

describe("frozen predictions and held-out confirmation", () => {
  it("does not reuse existing or pending measurements as its prospective test", () => {
    const s = anchored(),
      p = planFor(s);
    s.pending = {
      frequencyHz: p.targetFrequencyHz,
      outputVpp: p.predictions.changedTimeConstantVpp,
      source: "voice",
      transcript: "not confirmed",
      history: [],
    };
    expect(evaluateInvestigation(s, p).state).toBe("waiting");
    const reused = {
      ...s,
      measurements: [
        ...s.measurements,
        record(
          "anchor",
          p.targetFrequencyHz,
          p.predictions.changedTimeConstantVpp,
        ),
      ],
    };
    expect(evaluateInvestigation(reused, p).state).toBe("waiting");
  });
  it("compares a new result with the original prediction without refitting", () => {
    const s = anchored(),
      p = planFor(s),
      before = JSON.stringify(p);
    const updated = addTest(s, p, p.predictions.changedTimeConstantVpp);
    const r = evaluateInvestigation(updated, p);
    expect(r.state).toBe("changed-time-constant");
    expect(r.observations[0].changedTimeConstant.residualVpp).toBe(0);
    expect(JSON.stringify(p)).toBe(before);
    expect(r.observations[0].changedTimeConstant.predictedVpp).toBe(
      p.predictions.changedTimeConstantVpp,
    );
  });
  it("can prefer the scale explanation without asserting a hardware fault", () => {
    const s = anchored(),
      p = planFor(s),
      r = evaluateInvestigation(
        addTest(s, p, p.predictions.frequencyIndependentScaleVpp),
        p,
      );
    expect(r.state).toBe("frequency-independent-scale");
    expect(r.reason).toContain("does not prove");
  });
  it("keeps neither-matches as a real outcome", () => {
    const s = anchored(),
      p = planFor(s),
      r = evaluateInvestigation(addTest(s, p, 0), p);
    expect(r.state).toBe("neither");
    expect(r.reason).toContain("forcing a winner");
  });
  it("reports both matches when the illustrative bands overlap instead of forcing the nearest model", () => {
    const s = {
      ...createSession(),
      measurements: [record("anchor", 1000, 1.65)],
    };
    const p = planFor(s),
      midpoint =
        (p.predictions.changedTimeConstantVpp +
          p.predictions.frequencyIndependentScaleVpp) /
        2;
    expect(evaluateInvestigation(addTest(s, p, midpoint), p).state).toBe(
      "both",
    );
  });
  it("computes explicit illustrative bands and residual percentages", () => {
    const s = anchored(),
      p = planFor(s),
      prediction = p.predictions.changedTimeConstantVpp;
    const r = evaluateInvestigation(addTest(s, p, prediction * 1.02), p);
    const compared = r.observations[0].changedTimeConstant;
    expect(compared.residualPercent).toBeCloseTo(2);
    expect(compared.bandVpp).toBe(Math.max(prediction * 0.05, 0.01));
    expect(r.notes.join(" ")).toContain("not calibrated");
  });
  it("invalidates a receipt if the setup changes", () => {
    const s = anchored(),
      p = planFor(s);
    s.config.inputVpp = 3;
    expect(evaluateInvestigation(s, p).state).toBe("invalid");
  });
  it("invalidates a receipt if its anchor is undone or changed", () => {
    const s = anchored(),
      p = planFor(s);
    s.measurements = [];
    expect(evaluateInvestigation(s, p).state).toBe("invalid");
    s.measurements = [record("anchor", 2000, 0.18)];
    expect(evaluateInvestigation(s, p).state).toBe("invalid");
  });
  it("only evaluates new frequencies within the disclosed tolerance", () => {
    const s = anchored(),
      p = planFor(s);
    expect(
      evaluateInvestigation(
        addTest(s, p, 0.5, "outside", p.targetFrequencyHz * 1.021),
        p,
      ).state,
    ).toBe("waiting");
    expect(
      evaluateInvestigation(
        addTest(
          s,
          p,
          p.predictions.changedTimeConstantVpp,
          "inside",
          p.targetFrequencyHz * 1.02,
        ),
        p,
      ).state,
    ).toBe("changed-time-constant");
  });
  it("withholds a winner when repeated test outcomes conflict", () => {
    const s = anchored(),
      p = planFor(s);
    let updated = addTest(
      s,
      p,
      p.predictions.changedTimeConstantVpp,
      "repeat-a",
    );
    updated = addTest(
      updated,
      p,
      p.predictions.frequencyIndependentScaleVpp,
      "repeat-b",
    );
    const r = evaluateInvestigation(updated, p);
    expect(r.state).toBe("ambiguous");
    expect(r.observations.map((o) => o.measurementId)).toEqual([
      "repeat-a",
      "repeat-b",
    ]);
  });
  it("identifies synthetic demonstration provenance", () => {
    const s = anchored();
    s.measurements[0].source = "demo";
    const p = planFor(s);
    expect(planInvestigation(s).notes.join(" ")).toContain("synthetic");
    expect(
      evaluateInvestigation(addTest(s, p, 0), p).notes.join(" "),
    ).toContain("synthetic");
  });
});

describe("saved receipt validation", () => {
  it("round-trips a plan through JSON without losing its fixed predictions", () => {
    const p = planFor();
    expect(isInvestigationPlan(JSON.parse(JSON.stringify(p)))).toBe(true);
  });
  it.each([null, {}, { version: 1 }, { anchor: {} }])(
    "rejects malformed persisted data",
    (value) => expect(isInvestigationPlan(value)).toBe(false),
  );
  it("rejects non-finite values, changed predictions, missing anchor provenance and unsupported bands", () => {
    const original = planFor();
    const variants = [
      { ...original, targetFrequencyHz: NaN },
      {
        ...original,
        predictions: {
          ...original.predictions,
          changedTimeConstantVpp: Infinity,
        },
      },
      {
        ...original,
        predictions: { ...original.predictions, changedTimeConstantVpp: 0.123 },
      },
      { ...original, sourceIds: [] },
      { ...original, existingMeasurementIds: [] },
      { ...original, comparisonBand: { relative: 0.99, absoluteV: 1 } },
      {
        ...original,
        models: { ...original.models, changedTimeConstant: { tauSeconds: -1 } },
      },
    ];
    for (const p of variants) expect(isInvestigationPlan(p)).toBe(false);
  });
});
