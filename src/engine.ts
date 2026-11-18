/**
 * Benchlog's measurement layer. Speech recognition is probabilistic; committing a
 * laboratory record is not. No model-generated code or formula is executed here.
 * Deliberately bounded English commands keep every accepted value inspectable.
 */
export type Source = "voice" | "typed" | "demo";
export type Config = {
  title: string;
  resistanceOhm: number;
  capacitanceF: number;
  inputVpp: number;
};
export type Measurement = {
  id: string;
  frequencyHz: number;
  outputVpp: number;
  phaseDeg?: number;
  transcript: string;
  createdAt: string;
  source: Source;
  history: string[];
};
export type Pending = {
  frequencyHz?: number;
  outputVpp?: number;
  phaseDeg?: number;
  transcript: string;
  source: Source;
  history: string[];
};
export type Note = {
  id: string;
  text: string;
  createdAt: string;
  source: Source;
};
export type Session = {
  config: Config;
  measurements: Measurement[];
  notes: Note[];
  pending: Pending | null;
  reply: string;
};

export const DEFAULT_CONFIG: Config = {
  title: "RC low-pass response",
  resistanceOhm: 1_000,
  capacitanceF: 100e-9,
  inputVpp: 2,
};

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];
  if (!config.title.trim() || config.title.length > 120)
    errors.push("Give the experiment a title of 1 to 120 characters.");
  if (
    !Number.isFinite(config.resistanceOhm) ||
    config.resistanceOhm <= 0 ||
    config.resistanceOhm > 1e12
  )
    errors.push("Resistance must be greater than zero and no more than 1 TΩ.");
  if (
    !Number.isFinite(config.capacitanceF) ||
    config.capacitanceF <= 0 ||
    config.capacitanceF > 10
  )
    errors.push("Capacitance must be greater than zero and no more than 10 F.");
  if (
    !Number.isFinite(config.inputVpp) ||
    config.inputVpp <= 0 ||
    config.inputVpp > 1e6
  )
    errors.push(
      "Input must be greater than zero and no more than 1,000,000 V peak-to-peak.",
    );
  if (
    config.resistanceOhm > 0 &&
    config.capacitanceF > 0 &&
    !Number.isFinite(cutoffHz(config))
  )
    errors.push(
      "Those component values are too small to calculate a finite cutoff.",
    );
  return errors;
}

export function createSession(config: Config = DEFAULT_CONFIG): Session {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    config: { ...config },
    measurements: [],
    notes: [],
    pending: null,
    reply:
      "Ready. Say a frequency and an output voltage. I will read them back before you save.",
  };
}

export function cutoffHz(config: Config): number {
  return 1 / (2 * Math.PI * config.resistanceOhm * config.capacitanceF);
}
export function predictedGainDb(frequencyHz: number, config: Config): number {
  return -10 * Math.log10(1 + (frequencyHz / cutoffHz(config)) ** 2);
}
export function measuredGainDb(
  measurement: Pick<Measurement, "outputVpp">,
  config: Config,
): number {
  return 20 * Math.log10(measurement.outputVpp / config.inputVpp);
}

const digits: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const small: Record<string, number> = {
  ...digits,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const numberWord =
  "(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|point|and)";

function wordsToNumber(words: string): string {
  const pieces = words.trim().split(/\s+/);
  if (pieces.every((word) => word === "and" || word === "point")) return words;
  const point = pieces.indexOf("point");
  const whole = point >= 0 ? pieces.slice(0, point) : pieces;
  const fraction = point >= 0 ? pieces.slice(point + 1) : [];
  if (
    point >= 0 &&
    (!fraction.length || fraction.some((word) => !(word in digits)))
  )
    return words;
  // Only tens-plus-unit is a valid pair of adjacent number words. "one two",
  // "eleven twelve" and "one and two" must not silently become added numbers.
  const comparable = whole.filter((word) => word !== "and");
  for (let i = 1; i < comparable.length; i++) {
    const previous = small[comparable[i - 1]];
    const next = small[comparable[i]];
    if (
      previous !== undefined &&
      next !== undefined &&
      !(previous >= 20 && previous % 10 === 0 && next > 0 && next < 10)
    )
      return words;
  }
  let total = 0;
  let group = 0;
  for (const word of whole) {
    if (word === "and") continue;
    if (word in small) group += small[word];
    else if (word === "hundred") group = (group || 1) * 100;
    else if (word === "thousand" || word === "million") {
      total += (group || 1) * (word === "thousand" ? 1_000 : 1_000_000);
      group = 0;
    } else return words;
  }
  return (
    String(total + group) +
    (point >= 0 ? "." + fraction.map((word) => digits[word]).join("") : "")
  );
}

/** SI symbol case matters: mHz is millihertz and MHz is megahertz. */
export function normaliseSpeech(text: string): string {
  let clean = text
    .replace(/MHz\b/g, " megahertz ")
    .replace(/mHz\b/g, " millihertz ")
    .replace(/kHz\b/gi, " kilohertz ")
    .replace(/MV\b/g, " megavolts ")
    .replace(/mV\b/g, " millivolts ")
    .replace(/Vpp\b/gi, " volts peak to peak ")
    .replace(/Hz\b/g, " hertz ");
  clean = clean
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/\bminus\s+/g, "-")
    .replace(/\bnegative\s+/g, "-")
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "")
    .replace(/\bpeak-to-peak\b/g, "peak to peak")
    .replace(
      /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/g,
      "$1 $2",
    );
  clean = clean.replace(
    new RegExp("\\b" + numberWord + "(?:\\s+" + numberWord + ")*\\b", "g"),
    wordsToNumber,
  );
  return clean
    .replace(/([+-])\s+(?=\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type Quantity = {
  value: number;
  unit: "frequency" | "voltage" | "phase";
  start: number;
  end: number;
  label?: "input" | "output";
};
type Parsed = {
  frequencyHz?: number;
  outputVpp?: number;
  phaseDeg?: number;
  inputVpp?: number;
  errors: string[];
  found: boolean;
};
const numericPattern = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";

function parseMeasurements(text: string): Parsed {
  const t = normaliseSpeech(text);
  const result: Parsed = { errors: [], found: false };
  if (/\brms\b|root mean square/.test(t))
    result.errors.push(
      "This experiment uses peak-to-peak voltage. Please read the Vpp value from the instrument; I will not convert an unspecified waveform.",
    );
  if (/\bpeak\b/.test(t.replace(/peak to peak/g, "")))
    result.errors.push(
      "Peak voltage is different from peak-to-peak. Please give the peak-to-peak reading.",
    );
  if (/\b(?:nan|infinity|infinite)\b/.test(t))
    result.errors.push(
      "Please give a finite numerical measurement with its unit.",
    );
  if (/\bmegavolts?\b/.test(t))
    result.errors.push(
      "Megavolts are not supported by this bench notebook. Use volts or millivolts; capital MV does not mean millivolts.",
    );
  if (
    new RegExp(
      "\\b(?:" +
        Object.keys(small).join("|") +
        "|hundred|thousand|million|point)\\b",
    ).test(t)
  )
    result.errors.push(
      "I could not resolve the spoken number. Please repeat it clearly, for example one point six eight volts.",
    );
  const quantities: Quantity[] = [];
  const regex = new RegExp(
    "(" +
      numericPattern +
      ")\\s*(megahertz|mega hertz|mhz|kilohertz|kilo hertz|khz|millihertz|milli hertz|hertz|hz|millivolts?|milli volts?|mv|volts?|v|degrees?|deg|°)(?=\\s|$|[,.;!?])",
    "g",
  );
  for (const match of t.matchAll(regex)) {
    const raw = Number(match[1]);
    const unit = match[2];
    const start = match.index!;
    const prefix = t.slice(0, start);
    const labelMatch = prefix.match(
      /\b(input|output)\b(?:(?!\b(?:input|output)\b).)*$/,
    );
    const label = labelMatch?.[1] as Quantity["label"];
    if (/hertz|hz/.test(unit)) {
      const factor = /mega|^mhz$/.test(unit)
        ? 1e6
        : /kilo|^khz$/.test(unit)
          ? 1e3
          : /milli/.test(unit)
            ? 1e-3
            : 1;
      quantities.push({
        value: raw * factor,
        unit: "frequency",
        start,
        end: start + match[0].length,
      });
    } else if (/degree|deg|°/.test(unit))
      quantities.push({
        value: raw,
        unit: "phase",
        start,
        end: start + match[0].length,
      });
    else
      quantities.push({
        value: raw * (/milli|^mv$/.test(unit) ? 1e-3 : 1),
        unit: "voltage",
        start,
        end: start + match[0].length,
        label,
      });
  }
  result.found = quantities.length > 0;
  const frequencies = quantities.filter((q) => q.unit === "frequency");
  const voltages = quantities.filter((q) => q.unit === "voltage");
  const phases = quantities.filter((q) => q.unit === "phase");
  if (frequencies.length > 1)
    result.errors.push(
      "I heard more than one frequency. Please give one measurement at a time.",
    );
  if (phases.length > 1)
    result.errors.push(
      "I heard more than one phase value. Please give one phase value at a time.",
    );
  if (frequencies.length === 1) result.frequencyHz = frequencies[0].value;
  if (phases.length === 1) result.phaseDeg = phases[0].value;
  if (voltages.length === 1) {
    if (voltages[0].label === "input") result.inputVpp = voltages[0].value;
    else result.outputVpp = voltages[0].value;
  } else if (voltages.length > 1) {
    const inputs = voltages.filter((q) => q.label === "input");
    const outputs = voltages.filter((q) => q.label === "output");
    if (voltages.length === 2 && inputs.length === 1 && outputs.length === 1) {
      result.inputVpp = inputs[0].value;
      result.outputVpp = outputs[0].value;
    } else
      result.errors.push(
        "I heard several voltages without a unique input and output. Please label each, or give only the output.",
      );
  }
  if (
    result.frequencyHz !== undefined &&
    (!Number.isFinite(result.frequencyHz) ||
      result.frequencyHz <= 0 ||
      result.frequencyHz > 1e12)
  )
    result.errors.push(
      "Frequency must be greater than zero and no more than 1 THz.",
    );
  if (
    result.outputVpp !== undefined &&
    (!Number.isFinite(result.outputVpp) ||
      result.outputVpp < 0 ||
      result.outputVpp > 1e6)
  )
    result.errors.push(
      "Output must be zero or greater and no more than 1,000,000 V peak-to-peak.",
    );
  if (
    result.phaseDeg !== undefined &&
    (!Number.isFinite(result.phaseDeg) || Math.abs(result.phaseDeg) > 360)
  )
    result.errors.push(
      "Please give a phase between minus 360 and 360 degrees.",
    );
  // A bare number beside a named field is not allowed to borrow an old unit/value.
  for (const label of ["frequency", "output", "input", "phase"]) {
    const bare = new RegExp(
      "\\b" +
        label +
        "\\b\\s*(?:is|to|equals|of|at|was)?\\s*(" +
        numericPattern +
        ")(?![\\d.])",
      "g",
    );
    for (const match of t.matchAll(bare)) {
      const numberAt = match.index! + match[0].lastIndexOf(match[1]);
      if (!quantities.some((q) => q.start === numberAt))
        result.errors.push(
          "Please include a unit with the " +
            label +
            ", such as hertz, volts peak-to-peak or degrees.",
        );
    }
  }
  // If a number remains outside recognized quantities, a value may have been dropped.
  let remainder = t;
  for (const q of [...quantities].reverse())
    remainder =
      remainder.slice(0, q.start) +
      " ".repeat(q.end - q.start) +
      remainder.slice(q.end);
  if (new RegExp(numericPattern).test(remainder))
    result.errors.push(
      "There is a number I could not pair with a unit. Please repeat the reading with units.",
    );
  return result;
}

const compact = (n: number) => Number(n.toPrecision(5)).toString();
export function formatFrequency(hz: number): string {
  if (hz >= 1e6) return compact(hz / 1e6) + " MHz";
  if (hz >= 1e3) return compact(hz / 1e3) + " kHz";
  if (hz < 1 && hz > 0) return compact(hz * 1e3) + " mHz";
  return compact(hz) + " Hz";
}
export function formatVoltage(volts: number): string {
  return compact(volts) + " Vpp";
}
function speakFrequency(hz: number): string {
  return formatFrequency(hz)
    .replace("MHz", "megahertz")
    .replace("kHz", "kilohertz")
    .replace("mHz", "millihertz")
    .replace("Hz", "hertz");
}
function describe(p: Pending | Measurement): string {
  const bits: string[] = [];
  if (p.frequencyHz !== undefined)
    bits.push("At " + speakFrequency(p.frequencyHz));
  if (p.outputVpp !== undefined)
    bits.push("output " + compact(p.outputVpp) + " volts peak-to-peak");
  if (p.phaseDeg !== undefined)
    bits.push("phase " + compact(p.phaseDeg) + " degrees");
  return bits.join(", ");
}
export function pendingIssues(pending: Pending | null): string[] {
  if (!pending) return ["No reading to save."];
  const issues: string[] = [];
  if (pending.frequencyHz === undefined)
    issues.push("Please give the frequency with its unit.");
  if (pending.outputVpp === undefined)
    issues.push("Please give the output voltage with its unit.");
  return issues;
}
function pendingReply(pending: Pending, config: Config): string {
  const issues = pendingIssues(pending);
  const warning =
    pending.outputVpp !== undefined && pending.outputVpp > config.inputVpp
      ? " This is above the configured input; check the probe scaling and input setting."
      : "";
  return (
    describe(pending) +
    "." +
    warning +
    " " +
    (issues.length
      ? issues.join(" ")
      : "Say save, correct a value, or discard.")
  );
}
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export function handleUtterance(
  state: Session,
  rawText: string,
  source: Source = "typed",
): Session {
  const text = rawText.trim();
  const command = normaliseSpeech(text)
    .replace(/[.!?]+$/g, "")
    .trim();
  const reply = (message: string): Session => ({ ...state, reply: message });
  if (!text) return reply("I did not catch a reading. Please try again.");
  if (text.length > 2500)
    return reply(
      "That is too long for a single command. Please give one reading or a shorter note.",
    );
  if (
    /^(?:save|save that|save it|save (?:the )?(?:reading|measurement)|confirm|confirm (?:the )?(?:reading|measurement)|confirm that|yes save|yes save it)$/.test(
      command,
    )
  ) {
    const issues = pendingIssues(state.pending);
    if (issues.length) return reply(issues.join(" "));
    const p = state.pending!;
    if (state.measurements.length >= 2000)
      return reply(
        "This session has reached 2,000 readings. Export it and start a new session.",
      );
    const measurement: Measurement = {
      ...p,
      id: uid(),
      createdAt: new Date().toISOString(),
      frequencyHz: p.frequencyHz!,
      outputVpp: p.outputVpp!,
      history: [...p.history],
    };
    return {
      ...state,
      measurements: [...state.measurements, measurement],
      pending: null,
      reply: "Saved. " + describe(measurement) + ".",
    };
  }
  if (
    /^(?:cancel|cancel that|discard|discard that|(?:discard|cancel) (?:the )?(?:reading|measurement))$/.test(
      command,
    )
  )
    return {
      ...state,
      pending: null,
      reply: state.pending
        ? "Discarded the unconfirmed reading. Your saved measurements are unchanged."
        : "There is no unconfirmed reading to discard.",
    };
  if (
    /^(?:undo|undo that|undo last|undo last reading|undo the last reading|delete last reading|remove last reading)$/.test(
      command,
    )
  ) {
    if (state.pending)
      return reply(
        "There is an unconfirmed reading. Say discard to clear it, then undo last reading if needed.",
      );
    if (!state.measurements.length)
      return reply("There is no saved reading to undo.");
    const last = state.measurements.at(-1)!;
    return {
      ...state,
      measurements: state.measurements.slice(0, -1),
      pending: {
        frequencyHz: last.frequencyHz,
        outputVpp: last.outputVpp,
        phaseDeg: last.phaseDeg,
        transcript: last.transcript,
        source: last.source,
        history: [
          ...last.history,
          "Undo: returned the last saved reading to review.",
        ],
      },
      reply:
        "Moved the last reading back to review. " +
        describe(last) +
        ". Say save to restore it, correct a value, or discard.",
    };
  }
  if (
    /^(?:repeat|repeat that|read back|read that back|repeat last reading|repeat the last reading|read back last reading|read back the last reading|last reading)$/.test(
      command,
    )
  ) {
    if (state.pending) return reply(pendingReply(state.pending, state.config));
    const last = state.measurements.at(-1);
    return reply(
      last
        ? "Last saved reading: " + describe(last) + "."
        : "There are no saved readings yet.",
    );
  }
  const noteMatch = text.match(
    /^(?:note|add (?:a )?note|make (?:a )?note|observation)\s*[:,-]?\s+([\s\S]+)$/i,
  );
  if (noteMatch) {
    if (state.notes.length >= 500)
      return reply(
        "This session has reached 500 notes. Export it and start a new session.",
      );
    return {
      ...state,
      notes: [
        ...state.notes,
        {
          id: uid(),
          text: noteMatch[1].trim(),
          createdAt: new Date().toISOString(),
          source,
        },
      ],
      reply: "Note added: " + noteMatch[1].trim(),
    };
  }
  if (/^(?:help|what can i say|commands|show commands)$/.test(command))
    return reply(
      "Try: at one kilohertz, output one point six eight volts. Then say save, correct output to one point seven volts, or discard. You can also say note, followed by an observation; repeat last reading; undo last reading; summary; or suggest next frequency.",
    );
  if (
    /^(?:summary|summari[sz]e|summari[sz]e session|session summary|summari[sz]e the session)$/.test(
      command,
    )
  ) {
    const range = state.measurements.map((m) => m.frequencyHz);
    return reply(
      `${state.measurements.length} confirmed reading${state.measurements.length === 1 ? "" : "s"} and ${state.notes.length} note${state.notes.length === 1 ? "" : "s"}.` +
        (range.length
          ? ` Frequency range ${speakFrequency(Math.min(...range))} to ${speakFrequency(Math.max(...range))}.`
          : "") +
        ` The calculated cutoff is ${speakFrequency(cutoffHz(state.config))}. This is a prediction from the configured components, not a measured cutoff.`,
    );
  }
  if (
    /^(?:suggest (?:the )?next frequency|next frequency|what next|what should i (?:measure|try) next|suggest a frequency)$/.test(
      command,
    )
  ) {
    const fc = cutoffHz(state.config);
    const candidates = [fc, fc / 10, fc * 10, fc / 2, fc * 2, fc / 5, fc * 5];
    const next = candidates.find(
      (f) =>
        !state.measurements.some(
          (m) => Math.abs(Math.log10(m.frequencyHz / f)) < 0.05,
        ),
    );
    return reply(
      next
        ? `Try around ${speakFrequency(next)}. This is a suggested test point based on the calculated cutoff, not a measurement or an instrument command.`
        : "You have readings around the planned test points. Try repeating a reading to check consistency, or add an observation.",
    );
  }
  if (
    /\b(?:resistance|resistor|capacitance|capacitor|change input|set input)\b/.test(
      command,
    )
  )
    return reply(
      "Change component values or input amplitude in Experiment setup. Saved readings must keep the setup they were taken with.",
    );
  const isCorrection =
    /^(?:correct|change|replace|actually|no[, ]|make (?:that|it)|set (?:the )?(?:output|frequency|phase))/i.test(
      command,
    );
  if (isCorrection && !state.pending)
    return reply(
      "There is no reading waiting for correction. Say undo last reading to bring the last saved reading back for review.",
    );
  const parsed = parseMeasurements(text);
  if (
    parsed.inputVpp !== undefined &&
    (!Number.isFinite(parsed.inputVpp) ||
      Math.abs(parsed.inputVpp - state.config.inputVpp) >
        Math.max(1e-10, state.config.inputVpp * 1e-8))
  )
    parsed.errors.push(
      `The setup input is ${compact(state.config.inputVpp)} volts peak-to-peak. Your spoken input differs. Please change Experiment setup before taking readings.`,
    );
  if (parsed.errors.length)
    return reply(
      [...new Set(parsed.errors)].join(" ") +
        (state.pending
          ? " The reading in review has not changed."
          : " Nothing was saved."),
    );
  if (
    !parsed.found ||
    (parsed.frequencyHz === undefined &&
      parsed.outputVpp === undefined &&
      parsed.phaseDeg === undefined)
  )
    return reply(
      "I could not identify a measurement. Try “at one kilohertz, output one point six eight volts”, or say help. Nothing was saved.",
    );
  // An active draft is an explicit conversational context. A fresh complete reading
  // cannot replace it accidentally: the operator must save/discard first.
  if (
    state.pending &&
    !isCorrection &&
    state.pending.frequencyHz !== undefined &&
    state.pending.outputVpp !== undefined &&
    parsed.frequencyHz !== undefined &&
    parsed.outputVpp !== undefined
  )
    return reply(
      "A reading is already waiting for review. Say save or discard first, or start with “correct” to change it.",
    );
  const previous = state.pending;
  const pending: Pending = {
    ...(previous || { transcript: text, source, history: [] }),
    ...(parsed.frequencyHz !== undefined
      ? { frequencyHz: parsed.frequencyHz }
      : {}),
    ...(parsed.outputVpp !== undefined ? { outputVpp: parsed.outputVpp } : {}),
    ...(parsed.phaseDeg !== undefined ? { phaseDeg: parsed.phaseDeg } : {}),
    history: previous ? [...previous.history, text] : [],
  };
  return { ...state, pending, reply: pendingReply(pending, state.config) };
}

/** Quote every CSV field and neutralise spreadsheet formulas in untrusted text. */
function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function toCsv(session: Session): string {
  const rows: unknown[][] = [
    [
      "record_type",
      "experiment",
      "time_utc",
      "frequency_hz",
      "output_vpp",
      "phase_degrees",
      "input_vpp",
      "resistance_ohm",
      "capacitance_f",
      "measured_gain_db",
      "predicted_gain_db",
      "source",
      "original_transcript",
      "correction_history",
    ],
  ];
  for (const m of session.measurements)
    rows.push([
      "measurement",
      session.config.title,
      m.createdAt,
      m.frequencyHz,
      m.outputVpp,
      m.phaseDeg,
      session.config.inputVpp,
      session.config.resistanceOhm,
      session.config.capacitanceF,
      m.outputVpp === 0
        ? "-Infinity (zero output)"
        : measuredGainDb(m, session.config),
      predictedGainDb(m.frequencyHz, session.config),
      m.source,
      m.transcript,
      m.history.join(" | "),
    ]);
  for (const note of session.notes)
    rows.push([
      "note",
      session.config.title,
      note.createdAt,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      note.source,
      note.text,
      "",
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
const md = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|])/g, "\\$1")
    .replace(/[\r\n]+/g, " ");
export function toMarkdown(session: Session): string {
  const c = session.config;
  const lines = [
    "# " + md(c.title),
    "",
    "Exported from Benchlog. Only confirmed measurements are included.",
    "",
    "## Setup",
    "",
    `- Resistance: ${compact(c.resistanceOhm)} Ω`,
    `- Capacitance: ${compact(c.capacitanceF)} F`,
    `- Input: ${compact(c.inputVpp)} V peak-to-peak`,
    `- Calculated cutoff: ${compact(cutoffHz(c))} Hz`,
    "",
    "The curve assumes an ideal first-order RC low-pass circuit, measured across the capacitor with sine-wave input. Component tolerances, loading and instrument error are not included. The calculated response is not a physical measurement.",
    "",
    "## Confirmed readings",
    "",
    "| Time (UTC) | Frequency (Hz) | Output (Vpp) | Phase (°) | Measured gain (dB) | Predicted gain (dB) | Source |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const m of session.measurements)
    lines.push(
      `| ${m.createdAt} | ${compact(m.frequencyHz)} | ${compact(m.outputVpp)} | ${m.phaseDeg === undefined ? "" : compact(m.phaseDeg)} | ${m.outputVpp === 0 ? "−∞ (zero output)" : measuredGainDb(m, c).toFixed(3)} | ${predictedGainDb(m.frequencyHz, c).toFixed(3)} | ${m.source} |`,
    );
  if (!session.measurements.length) lines.push("", "No confirmed readings.");
  lines.push("", "## Transcript and corrections", "");
  session.measurements.forEach((m, i) => {
    lines.push(`### Reading ${i + 1}`, "", "**Original:** " + md(m.transcript));
    for (const correction of m.history) lines.push("- " + md(correction));
    lines.push("");
  });
  lines.push("## Observations", "");
  for (const n of session.notes)
    lines.push(`- ${n.createdAt} (${n.source}): ${md(n.text)}`);
  if (!session.notes.length) lines.push("No observations recorded.");
  if (session.pending)
    lines.push(
      "",
      "An unconfirmed reading was present at export and was deliberately excluded.",
    );
  if (session.measurements.some((m) => m.source === "demo"))
    lines.push(
      "",
      "**Demonstration data:** Records labelled demo are illustrative values, not readings from a physical experiment.",
    );
  return lines.join("\n") + "\n";
}
