import type { Config, Measurement, Session } from "./engine";

export const INVESTIGATION_FREQUENCY_TOLERANCE = 0.02;
export const INVESTIGATION_COMPARISON_BAND = {
  relative: 0.05,
  absoluteV: 0.01,
} as const;
const FREQUENCY_FACTORS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const MIN_FREQUENCY_HZ = 1;
const MAX_FREQUENCY_HZ = 1e6;

export type InvestigationPlan = {
  version: 1;
  id: string;
  createdAt: string;
  anchor: Measurement;
  config: Config;
  sourceIds: string[];
  existingMeasurementIds: string[];
  models: {
    changedTimeConstant: { tauSeconds: number };
    frequencyIndependentScale: { tauSeconds: number; scale: number };
  };
  candidateFrequenciesHz: number[];
  targetFrequencyHz: number;
  predictions: {
    changedTimeConstantVpp: number;
    frequencyIndependentScaleVpp: number;
  };
  separationVpp: number;
  frequencyToleranceFraction: number;
  comparisonBand: { relative: number; absoluteV: number };
};
export type InvestigationPlanning = {
  state: "ready" | "need-anchor" | "indistinguishable" | "no-target";
  reason: string;
  plan: InvestigationPlan | null;
  notes: string[];
};
export type ModelComparison = {
  predictedVpp: number;
  residualVpp: number;
  /** Absolute residual as a percentage of this model's prediction. */
  residualPercent: number;
  bandVpp: number;
  matches: boolean;
};
export type InvestigationObservation = {
  measurementId: string;
  frequencyHz: number;
  outputVpp: number;
  changedTimeConstant: ModelComparison;
  frequencyIndependentScale: ModelComparison;
};
export type InvestigationEvaluation = {
  state:
    | "waiting"
    | "invalid"
    | "changed-time-constant"
    | "frequency-independent-scale"
    | "both"
    | "neither"
    | "ambiguous";
  reason: string;
  observations: InvestigationObservation[];
  notes: string[];
};

const finitePositive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const validId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 200;
const finiteDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const sameNumber = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(Number.MIN_VALUE, Math.abs(b) * 1e-9);
const nearFrequency = (
  a: number,
  b: number,
  tolerance = INVESTIGATION_FREQUENCY_TOLERANCE,
) => Math.abs(a - b) / b <= tolerance + 1e-12;
const notesForPlan = [
  "Both explanations fit the selected anchor by construction. That single reading cannot distinguish them.",
  "A changed time constant means a changed R×C product. These readings cannot identify resistance or capacitance separately.",
  "A frequency-independent scale is a mathematical alternative, not proof of a probe-setting fault or any other hardware cause.",
  "The suggested point maximises absolute voltage separation only over the disclosed candidate grid, bounded to 1 Hz–1 MHz. No noise model or probability is claimed.",
];

/** Amplitude prediction for an unloaded first-order low-pass with a fixed scale. */
export function predictInvestigationVpp(
  inputVpp: number,
  frequencyHz: number,
  tauSeconds: number,
  scale = 1,
): number {
  return (
    (inputVpp * scale) / Math.hypot(1, 2 * Math.PI * frequencyHz * tauSeconds)
  );
}

function usableConfig(config: Config): boolean {
  return (
    typeof config?.title === "string" &&
    config.title.length > 0 &&
    config.title.length <= 120 &&
    finitePositive(config.resistanceOhm) &&
    config.resistanceOhm <= 1e12 &&
    finitePositive(config.capacitanceF) &&
    config.capacitanceF <= 10 &&
    finitePositive(config.inputVpp) &&
    config.inputVpp >= 1e-9 &&
    config.inputVpp <= 1e6 &&
    finitePositive(config.resistanceOhm * config.capacitanceF)
  );
}
function modelsFromAnchor(
  config: Config,
  anchor: Pick<Measurement, "frequencyHz" | "outputVpp">,
): InvestigationPlan["models"] | null {
  if (
    !finitePositive(anchor.frequencyHz) ||
    anchor.frequencyHz > 1e12 ||
    !finitePositive(anchor.outputVpp) ||
    anchor.outputVpp >= config.inputVpp
  )
    return null;
  const ratio = config.inputVpp / anchor.outputVpp;
  const tauSeconds =
    Math.sqrt(ratio * ratio - 1) / (2 * Math.PI * anchor.frequencyHz);
  const configuredTau = config.resistanceOhm * config.capacitanceF;
  const scale =
    (anchor.outputVpp / config.inputVpp) *
    Math.hypot(1, 2 * Math.PI * anchor.frequencyHz * configuredTau);
  if (!finitePositive(tauSeconds) || !finitePositive(scale)) return null;
  return {
    changedTimeConstant: { tauSeconds },
    frequencyIndependentScale: { tauSeconds: configuredTau, scale },
  };
}

/**
 * Creates a prospective receipt. Only the latest confirmed positive reading is
 * fitted. Arrays and anchor/config are copied so later edits cannot refit a plan.
 */
export function planInvestigation(
  session: Session,
  options: { id?: string; createdAt?: string } = {},
): InvestigationPlanning {
  const notes = [...notesForPlan];
  const failure = (
    state: InvestigationPlanning["state"],
    reason: string,
  ): InvestigationPlanning => ({ state, reason, plan: null, notes });
  if (!usableConfig(session.config))
    return failure(
      "need-anchor",
      "The experiment setup is outside this comparison’s numerical range. Check the input and component values.",
    );
  const anchor = [...session.measurements]
    .reverse()
    .find((m) => finitePositive(m.outputVpp));
  if (!anchor)
    return failure(
      "need-anchor",
      "Confirm a positive output reading first. Pending readings are not evidence for a comparison.",
    );
  const models = modelsFromAnchor(session.config, anchor);
  if (!models)
    return failure(
      "need-anchor",
      "The latest positive reading must be below the configured input to fit these two passive low-pass explanations. Review that reading and its units.",
    );
  const fc =
    1 /
    (2 * Math.PI * session.config.resistanceOhm * session.config.capacitanceF);
  const grid = [
    ...new Set(
      FREQUENCY_FACTORS.map((factor) =>
        Math.min(
          MAX_FREQUENCY_HZ,
          Math.max(MIN_FREQUENCY_HZ, Number((fc * factor).toPrecision(2))),
        ),
      ),
    ),
  ]
    .filter(
      (f) =>
        finitePositive(f) &&
        !session.measurements.some(
          (m) =>
            finitePositive(m.frequencyHz) && nearFrequency(m.frequencyHz, f),
        ),
    )
    .sort((a, b) => a - b);
  if (!grid.length)
    return failure(
      "no-target",
      "Every candidate frequency already has a confirmed reading within 2%. Start a fresh comparison experiment rather than reusing a result as a prospective test.",
    );
  const candidates = grid
    .map((frequencyHz) => {
      const changedTimeConstantVpp = predictInvestigationVpp(
        session.config.inputVpp,
        frequencyHz,
        models.changedTimeConstant.tauSeconds,
      );
      const frequencyIndependentScaleVpp = predictInvestigationVpp(
        session.config.inputVpp,
        frequencyHz,
        models.frequencyIndependentScale.tauSeconds,
        models.frequencyIndependentScale.scale,
      );
      return {
        frequencyHz,
        changedTimeConstantVpp,
        frequencyIndependentScaleVpp,
        separationVpp: Math.abs(
          changedTimeConstantVpp - frequencyIndependentScaleVpp,
        ),
      };
    })
    .filter(
      (p) =>
        finitePositive(p.changedTimeConstantVpp) &&
        p.changedTimeConstantVpp >= 1e-12 &&
        p.changedTimeConstantVpp <= 1e6 &&
        finitePositive(p.frequencyIndependentScaleVpp) &&
        p.frequencyIndependentScaleVpp >= 1e-12 &&
        p.frequencyIndependentScaleVpp <= 1e6 &&
        Number.isFinite(p.separationVpp),
    );
  if (!candidates.length)
    return failure(
      "no-target",
      "These fitted values do not produce usable predictions within the candidate range. Check the anchor and units.",
    );
  const best = candidates.reduce((a, b) =>
    b.separationVpp > a.separationVpp ? b : a,
  );
  if (best.separationVpp < session.config.inputVpp * 0.01)
    return failure(
      "indistinguishable",
      "These explanations differ by less than 1% of the input across the candidate grid. This comparison would not provide a useful separation; record a genuine discrepancy first. The 1% rule is a prototype planning threshold, not instrument precision.",
    );
  const id =
    options.id ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `comparison-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (!validId(id) || !finiteDate(createdAt))
    throw new Error(
      "Comparison metadata must contain a valid ID and timestamp.",
    );
  const plan: InvestigationPlan = {
    version: 1,
    id,
    createdAt,
    anchor: { ...anchor, history: [...anchor.history] },
    config: { ...session.config },
    sourceIds: [anchor.id],
    existingMeasurementIds: session.measurements.map((m) => m.id),
    models,
    candidateFrequenciesHz: candidates.map((c) => c.frequencyHz),
    targetFrequencyHz: best.frequencyHz,
    predictions: {
      changedTimeConstantVpp: best.changedTimeConstantVpp,
      frequencyIndependentScaleVpp: best.frequencyIndependentScaleVpp,
    },
    separationVpp: best.separationVpp,
    frequencyToleranceFraction: INVESTIGATION_FREQUENCY_TOLERANCE,
    comparisonBand: { ...INVESTIGATION_COMPARISON_BAND },
  };
  if (anchor.source === "demo")
    notes.push(
      "The anchor is synthetic demonstration data. The plan is illustrative, not a physical circuit finding.",
    );
  return {
    state: "ready",
    reason:
      "Two explanations fit this one reading. A new measurement at the suggested frequency can compare their different predictions.",
    plan,
    notes,
  };
}

/** Validate persisted receipts before displaying or evaluating them. */
export function isInvestigationPlan(
  value: unknown,
): value is InvestigationPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as InvestigationPlan;
  if (
    p.version !== 1 ||
    !validId(p.id) ||
    !finiteDate(p.createdAt) ||
    !p.config ||
    !usableConfig(p.config) ||
    !p.anchor ||
    !validId(p.anchor.id) ||
    !finiteDate(p.anchor.createdAt) ||
    typeof p.anchor.transcript !== "string" ||
    !Array.isArray(p.anchor.history) ||
    !p.anchor.history.every((h) => typeof h === "string") ||
    !["voice", "typed", "demo"].includes(p.anchor.source)
  )
    return false;
  if (
    !Array.isArray(p.sourceIds) ||
    p.sourceIds.length !== 1 ||
    p.sourceIds[0] !== p.anchor.id ||
    !Array.isArray(p.existingMeasurementIds) ||
    p.existingMeasurementIds.length > 2000 ||
    !p.existingMeasurementIds.every(validId) ||
    !p.existingMeasurementIds.includes(p.anchor.id)
  )
    return false;
  if (!p.models?.changedTimeConstant || !p.models.frequencyIndependentScale)
    return false;
  const expected = modelsFromAnchor(p.config, p.anchor);
  if (
    !expected ||
    !finitePositive(p.models.changedTimeConstant.tauSeconds) ||
    !finitePositive(p.models.frequencyIndependentScale.tauSeconds) ||
    !finitePositive(p.models.frequencyIndependentScale.scale) ||
    !sameNumber(
      p.models.changedTimeConstant.tauSeconds,
      expected.changedTimeConstant.tauSeconds,
    ) ||
    !sameNumber(
      p.models.frequencyIndependentScale.tauSeconds,
      expected.frequencyIndependentScale.tauSeconds,
    ) ||
    !sameNumber(
      p.models.frequencyIndependentScale.scale,
      expected.frequencyIndependentScale.scale,
    )
  )
    return false;
  if (
    !Array.isArray(p.candidateFrequenciesHz) ||
    p.candidateFrequenciesHz.length === 0 ||
    p.candidateFrequenciesHz.length > FREQUENCY_FACTORS.length ||
    !p.candidateFrequenciesHz.every(
      (f) =>
        finitePositive(f) && f >= MIN_FREQUENCY_HZ && f <= MAX_FREQUENCY_HZ,
    ) ||
    !finitePositive(p.targetFrequencyHz) ||
    !p.candidateFrequenciesHz.includes(p.targetFrequencyHz) ||
    !p.predictions
  )
    return false;
  const first = p.predictions.changedTimeConstantVpp,
    second = p.predictions.frequencyIndependentScaleVpp;
  if (
    !finitePositive(first) ||
    first < 1e-12 ||
    first > 1e6 ||
    !finitePositive(second) ||
    second < 1e-12 ||
    second > 1e6 ||
    !finitePositive(p.separationVpp) ||
    !sameNumber(p.separationVpp, Math.abs(first - second))
  )
    return false;
  if (
    !sameNumber(
      first,
      predictInvestigationVpp(
        p.config.inputVpp,
        p.targetFrequencyHz,
        expected.changedTimeConstant.tauSeconds,
      ),
    ) ||
    !sameNumber(
      second,
      predictInvestigationVpp(
        p.config.inputVpp,
        p.targetFrequencyHz,
        expected.frequencyIndependentScale.tauSeconds,
        expected.frequencyIndependentScale.scale,
      ),
    )
  )
    return false;
  return (
    p.frequencyToleranceFraction === INVESTIGATION_FREQUENCY_TOLERANCE &&
    p.comparisonBand?.relative === INVESTIGATION_COMPARISON_BAND.relative &&
    p.comparisonBand.absoluteV === INVESTIGATION_COMPARISON_BAND.absoluteV
  );
}

function compareModel(
  observed: number,
  predicted: number,
  plan: InvestigationPlan,
): ModelComparison {
  const residualVpp = Math.abs(observed - predicted);
  const bandVpp = Math.max(
    plan.comparisonBand.relative * predicted,
    plan.comparisonBand.absoluteV,
  );
  return {
    predictedVpp: predicted,
    residualVpp,
    residualPercent: (100 * residualVpp) / predicted,
    bandVpp,
    matches: residualVpp <= bandVpp + 1e-12,
  };
}

/** Compare new confirmed measurements with the copied predictions, never refit. */
export function evaluateInvestigation(
  session: Session,
  plan: InvestigationPlan,
): InvestigationEvaluation {
  const notes = [
    "The predictions were frozen before this test. New measurements do not refit them.",
    "A match uses an illustrative band of ±max(5% of the prediction, 0.01 Vpp). This is not calibrated instrument uncertainty, a confidence interval or a probability.",
    "Only new confirmed reading IDs within ±2% of the planned frequency are compared. Predictions remain those at the planned frequency; small frequency differences are not corrected.",
    "A match can distinguish these two mathematical explanations, not prove a component fault or identify resistance and capacitance separately.",
  ];
  const result = (
    state: InvestigationEvaluation["state"],
    reason: string,
    observations: InvestigationObservation[] = [],
  ): InvestigationEvaluation => ({ state, reason, observations, notes });
  if (!isInvestigationPlan(plan))
    return result(
      "invalid",
      "The saved comparison receipt is invalid. Create a new comparison from a confirmed reading.",
    );
  const current = session.config,
    original = plan.config;
  if (
    current.title !== original.title ||
    current.resistanceOhm !== original.resistanceOhm ||
    current.capacitanceF !== original.capacitanceF ||
    current.inputVpp !== original.inputVpp
  )
    return result(
      "invalid",
      "The experiment setup changed after these predictions were made. Create a new comparison for the current setup.",
    );
  const anchor = session.measurements.find((m) => m.id === plan.anchor.id);
  if (
    !anchor ||
    anchor.frequencyHz !== plan.anchor.frequencyHz ||
    anchor.outputVpp !== plan.anchor.outputVpp ||
    anchor.source !== plan.anchor.source
  )
    return result(
      "invalid",
      "The anchor reading was removed or changed. This receipt no longer belongs to the current evidence; create a new comparison.",
    );
  const observations = session.measurements
    .filter(
      (m) =>
        !plan.existingMeasurementIds.includes(m.id) &&
        finitePositive(m.frequencyHz) &&
        typeof m.outputVpp === "number" &&
        Number.isFinite(m.outputVpp) &&
        m.outputVpp >= 0 &&
        m.outputVpp <= 1e6 &&
        nearFrequency(
          m.frequencyHz,
          plan.targetFrequencyHz,
          plan.frequencyToleranceFraction,
        ),
    )
    .map((m) => ({
      measurementId: m.id,
      frequencyHz: m.frequencyHz,
      outputVpp: m.outputVpp,
      changedTimeConstant: compareModel(
        m.outputVpp,
        plan.predictions.changedTimeConstantVpp,
        plan,
      ),
      frequencyIndependentScale: compareModel(
        m.outputVpp,
        plan.predictions.frequencyIndependentScaleVpp,
        plan,
      ),
    }));
  if (!observations.length)
    return result(
      "waiting",
      "Take a new reading at the planned frequency, then confirm it. Existing and pending readings cannot count as the held-out test.",
    );
  if (
    plan.anchor.source === "demo" ||
    session.measurements.some(
      (m) =>
        observations.some((o) => o.measurementId === m.id) &&
        m.source === "demo",
    )
  )
    notes.push(
      "This comparison uses synthetic demonstration data. The result is illustrative, not evidence from a physical experiment.",
    );
  const allA = observations.every((o) => o.changedTimeConstant.matches),
    allB = observations.every((o) => o.frequencyIndependentScale.matches);
  if (allA && allB)
    return result(
      "both",
      "Both predictions match within the illustrative comparison band. This test does not distinguish the two explanations.",
      observations,
    );
  if (allA)
    return result(
      "changed-time-constant",
      "The changed-time-constant prediction matches every test reading within the illustrative band; the scale-only prediction does not consistently match. This is a comparison between models, not a hardware diagnosis.",
      observations,
    );
  if (allB)
    return result(
      "frequency-independent-scale",
      "The scale-only prediction matches every test reading within the illustrative band; the changed-time-constant prediction does not consistently match. This does not prove a probe or instrument fault.",
      observations,
    );
  if (
    observations.every(
      (o) =>
        !o.changedTimeConstant.matches && !o.frequencyIndependentScale.matches,
    )
  )
    return result(
      "neither",
      "Neither prediction matches within the illustrative band. Keep the discrepancy: these two explanations may be incomplete. Review the setup and readings rather than forcing a winner.",
      observations,
    );
  return result(
    "ambiguous",
    "The repeated test readings give inconsistent outcomes. Repeat the measurement and review the record before preferring either explanation.",
    observations,
  );
}
