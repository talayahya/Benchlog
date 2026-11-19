import { useId } from "react";
import {
  formatFrequency,
  formatVoltage,
  type Measurement,
  type Session,
} from "./engine";
import {
  evaluateInvestigation,
  planInvestigation,
  type InvestigationPlan,
} from "./investigation";
import "./investigation.css";

function shortVoltage(value: number): string {
  return formatVoltage(Number(value.toPrecision(3)));
}

function sourceLabel(reading: Measurement): string {
  return reading.source === "demo"
    ? "Synthetic example"
    : reading.source === "voice"
      ? "Spoken reading"
      : "Typed reading";
}

function recordedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : value;
}

export default function InvestigationPanel({
  session,
  onCommand,
}: {
  session: Session;
  onCommand: (text: string) => void;
}) {
  const titleId = useId();
  const plan = (
    session as Session & {
      investigation?: InvestigationPlan | null;
    }
  ).investigation;
  const proposal = !plan ? planInvestigation(session) : null;
  const result = plan ? evaluateInvestigation(session, plan) : null;
  const latest = result?.observations.at(-1);
  const waiting = result?.state === "waiting";
  const usable = Boolean(plan && result?.state !== "invalid");

  return (
    <section className="investigation" aria-labelledby={titleId}>
      <div className="investigation-heading">
        <div>
          <h3 id={titleId}>What would tell them apart?</h3>
          <p>One reading can fit more than one explanation.</p>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            onCommand(plan ? "New comparison" : "Compare explanations")
          }
          disabled={
            Boolean(session.pending) || (!plan && proposal?.state !== "ready")
          }
        >
          {plan ? "New comparison" : "Compare explanations"}
        </button>
      </div>

      {!plan ? (
        <div className="investigation-empty">
          <p>
            Compare a change in the circuit's response with a change in how its
            amplitude is displayed. Both explanations must fit the same saved
            reading before we look for a test that separates them.
          </p>
          <p className="investigation-guidance">
            {session.pending
              ? "Confirm or discard the pending reading before starting a comparison."
              : proposal?.reason}
          </p>
          {proposal && proposal.notes.length > 0 && (
            <details className="investigation-method">
              <summary>Why this comparison has limits</summary>
              <ul>
                {proposal.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : !usable ? (
        <p className="investigation-guidance">{result?.reason}</p>
      ) : (
        <>
          <div className="investigation-anchor">
            <span className="investigation-anchor-label">
              Both explanations start here
            </span>
            <strong>
              {formatFrequency(plan.anchor.frequencyHz)}
              <span aria-hidden="true"> / </span>
              <span className="sr-only">, output </span>
              {shortVoltage(plan.anchor.outputVpp)}
            </strong>
            <span>{sourceLabel(plan.anchor)} · confirmed</span>
          </div>

          <svg
            className="investigation-branch"
            viewBox="0 0 600 30"
            aria-hidden="true"
          >
            <path d="M300 0V13M150 30V13H450V30" />
            <circle cx="300" cy="2" r="2" />
          </svg>

          <div className="investigation-test">
            <span>Next measurement</span>
            <strong>{formatFrequency(plan.targetFrequencyHz)}</strong>
            <p>
              Keep the input at {formatVoltage(plan.config.inputVpp)}. Read the
              output across the capacitor.
            </p>
          </div>

          <div
            className="investigation-models"
            aria-label="Predictions made before the next reading"
          >
            <div className="investigation-model">
              <h4>
                <span>A</span> Circuit response changed
              </h4>
              <p>
                A different R × C time constant changes how the circuit responds
                to frequency.
              </p>
              <div className="investigation-prediction">
                <span>Predicted output</span>
                <strong>
                  {shortVoltage(plan.predictions.changedTimeConstantVpp)}
                </strong>
              </div>
              {latest && (
                <p
                  className={`investigation-match ${latest.changedTimeConstant.matches ? "is-compatible" : "is-outside"}`}
                >
                  {latest.changedTimeConstant.matches
                    ? "Within the comparison band"
                    : "Outside the comparison band"}
                </p>
              )}
            </div>
            <div className="investigation-model">
              <h4>
                <span>B</span> Reading scale changed
              </h4>
              <p>
                The nominal curve keeps its shape, but every displayed amplitude
                is multiplied by the same factor.
              </p>
              <div className="investigation-prediction">
                <span>Predicted output</span>
                <strong>
                  {shortVoltage(plan.predictions.frequencyIndependentScaleVpp)}
                </strong>
              </div>
              {latest && (
                <p
                  className={`investigation-match ${latest.frequencyIndependentScale.matches ? "is-compatible" : "is-outside"}`}
                >
                  {latest.frequencyIndependentScale.matches
                    ? "Within the comparison band"
                    : "Outside the comparison band"}
                </p>
              )}
            </div>
          </div>

          <div
            className={`investigation-outcome ${waiting ? "is-waiting" : "has-observation"}`}
          >
            <div className="investigation-outcome-label">
              <span>
                {waiting ? "Waiting for the test" : "Confirmed observation"}
              </span>
              {latest && (
                <strong>
                  {shortVoltage(latest.outputVpp)}
                  <small> at {formatFrequency(latest.frequencyHz)}</small>
                  {result && result.observations.length > 1 && (
                    <small>
                      Latest of {result.observations.length} test readings
                    </small>
                  )}
                </strong>
              )}
            </div>
            <div>
              <p>{result?.reason}</p>
              {waiting && (
                <p className="investigation-say">
                  Say the frequency and output, then “save reading”.
                </p>
              )}
              {!waiting && latest && (
                <p className="investigation-say">
                  A compatible model is an explanation to investigate, not proof
                  of a faulty component.
                </p>
              )}
            </div>
          </div>

          <div className="investigation-footer">
            <details className="investigation-receipt">
              <summary>Prediction receipt · fixed before the test</summary>
              <dl>
                <div>
                  <dt>Created</dt>
                  <dd>{recordedAt(plan.createdAt)}</dd>
                </div>
                <div>
                  <dt>Original reading</dt>
                  <dd>“{plan.anchor.transcript}”</dd>
                </div>
                {plan.anchor.history.length > 0 && (
                  <div>
                    <dt>Corrections retained</dt>
                    <dd>
                      <ul>
                        {plan.anchor.history.map((entry, i) => (
                          <li key={i}>{entry}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Test frequency</dt>
                  <dd>
                    {formatFrequency(plan.targetFrequencyHz)} ±{" "}
                    {plan.frequencyToleranceFraction * 100}%
                  </dd>
                </div>
                <div>
                  <dt>Comparison band</dt>
                  <dd>
                    ± the larger of {plan.comparisonBand.relative * 100}% or{" "}
                    {formatVoltage(plan.comparisonBand.absoluteV)}. An
                    illustrative rule, not instrument accuracy or statistical
                    confidence.
                  </dd>
                </div>
                <div>
                  <dt>Prediction A</dt>
                  <dd>
                    {plan.predictions.changedTimeConstantVpp.toPrecision(6)} Vpp
                  </dd>
                </div>
                <div>
                  <dt>Prediction B</dt>
                  <dd>
                    {plan.predictions.frequencyIndependentScaleVpp.toPrecision(
                      6,
                    )}{" "}
                    Vpp
                  </dd>
                </div>
              </dl>
              <p>
                Both models were fitted to the same anchor reading. The next
                frequency was chosen from a finite test grid for its predicted
                separation. Later readings do not change these predictions.
              </p>
              {result && result.notes.length > 0 && (
                <ul>
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </details>
            <button
              className="quiet"
              type="button"
              onClick={() => onCommand("Review the investigation")}
            >
              Review explanation
            </button>
          </div>
        </>
      )}
    </section>
  );
}
