import { createSession, validateConfig, type Session } from "./engine";
import { isInvestigationPlan } from "./investigation";
const KEY = "benchlog.notebook.v1";
export function loadSession(): { session: Session; error: string | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { session: createSession(), error: null };
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !saved.session || !isSession(saved.session))
      throw new Error("invalid");
    return {
      session: {
        ...saved.session,
        pending: null,
        reply: "Welcome back. Your confirmed readings are here.",
      },
      error: null,
    };
  } catch {
    return {
      session: createSession(),
      error:
        "The saved notebook could not be loaded. The stored copy has not been replaced. Export anything you need before starting a new notebook.",
    };
  }
}
export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const s = value as Session;
  if (
    !s.config ||
    typeof s.config.title !== "string" ||
    validateConfig(s.config).length ||
    !Array.isArray(s.measurements) ||
    !Array.isArray(s.notes)
  )
    return false;
  if (s.measurements.length > 5000 || s.notes.length > 5000) return false;
  if (
    s.investigation !== undefined &&
    s.investigation !== null &&
    !isInvestigationPlan(s.investigation)
  )
    return false;
  return (
    s.measurements.every(
      (m) =>
        typeof m.id === "string" &&
        Number.isFinite(m.frequencyHz) &&
        m.frequencyHz > 0 &&
        Number.isFinite(m.outputVpp) &&
        m.outputVpp >= 0 &&
        (m.phaseDeg === undefined || Number.isFinite(m.phaseDeg)) &&
        typeof m.transcript === "string" &&
        typeof m.createdAt === "string" &&
        ["voice", "typed", "demo"].includes(m.source) &&
        Array.isArray(m.history) &&
        m.history.every((x) => typeof x === "string"),
    ) &&
    s.notes.every(
      (n) =>
        typeof n.id === "string" &&
        typeof n.text === "string" &&
        typeof n.createdAt === "string" &&
        ["voice", "typed", "demo"].includes(n.source),
    )
  );
}
export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, session }));
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
