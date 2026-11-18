import { useId, useState } from "react";
import {
  cutoffHz,
  predictedGainDb,
  measuredGainDb,
  formatFrequency,
  type Session,
} from "./engine";

export default function Plot({
  session,
  demo,
}: {
  session: Session;
  demo: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const fc = cutoffHz(session.config);
  const values = session.measurements.filter((m) => m.outputVpp > 0);
  const low = Math.min(fc / 30, ...values.map((m) => m.frequencyHz)) / 1.2;
  const high = Math.max(fc * 30, ...values.map((m) => m.frequencyHz)) * 1.2;
  const min =
    Math.floor(
      Math.min(-32, ...values.map((m) => measuredGainDb(m, session.config))) /
        10,
    ) * 10;
  const max =
    Math.ceil(
      Math.max(0, ...values.map((m) => measuredGainDb(m, session.config))) / 10,
    ) *
      10 +
    2;
  const w = 680,
    h = 290,
    left = 54,
    right = 20,
    top = 24,
    bottom = 44;
  const x = (f: number) =>
    left +
    ((Math.log10(f) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))) *
      (w - left - right);
  const y = (db: number) =>
    top + ((max - db) / (max - min)) * (h - top - bottom);
  const curve = Array.from({ length: 161 }, (_, i) => {
    const f = low * Math.pow(high / low, i / 160);
    return `${i ? "L" : "M"}${x(f)},${y(predictedGainDb(f, session.config))}`;
  }).join(" ");
  const ticks: number[] = [];
  for (
    let p = Math.ceil(Math.log10(low));
    p <= Math.floor(Math.log10(high));
    p++
  )
    ticks.push(10 ** p);
  const yticks: number[] = [];
  for (let a = Math.ceil(min / 10) * 10; a <= max; a += 10) yticks.push(a);
  const active = values.find((m) => m.id === selected);
  return (
    <div className="plot-wrap">
      <svg
        className="response-plot"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>RC low-pass frequency response</title>
        <desc id={`${id}-desc`}>
          Dashed line: ideal calculated gain. Circles:{" "}
          {demo ? "synthetic example" : "confirmed"} readings. The horizontal
          axis is logarithmic frequency in hertz. The vertical axis is voltage
          gain in decibels. Exact readings are in the table below.
        </desc>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect
              x={left}
              y={top}
              width={w - left - right}
              height={h - top - bottom}
            />
          </clipPath>
        </defs>
        {yticks.map((db) => (
          <g key={db}>
            <line
              className="grid-line"
              x1={left}
              x2={w - right}
              y1={y(db)}
              y2={y(db)}
            />
            <text
              className="axis-text"
              x={left - 12}
              y={y(db) + 4}
              textAnchor="end"
            >
              {db}
            </text>
          </g>
        ))}
        {ticks.map((f) => (
          <g key={f}>
            <line
              className="grid-line"
              x1={x(f)}
              x2={x(f)}
              y1={top}
              y2={h - bottom}
            />
            <text
              className="axis-text"
              x={x(f)}
              y={h - bottom + 24}
              textAnchor="middle"
            >
              {formatFrequency(f)}
            </text>
          </g>
        ))}
        <text className="axis-label" x="14" y="16">
          dB
        </text>
        <line
          className="cutoff-line"
          x1={x(fc)}
          x2={x(fc)}
          y1={top}
          y2={h - bottom}
        />
        <text
          className="cutoff-label"
          x={Math.min(w - right - 110, x(fc) + 8)}
          y={top + 12}
        >
          f<tspan baselineShift="sub">c</tspan> {formatFrequency(fc)}
        </text>
        <g clipPath={`url(#${id}-clip)`}>
          <path className="theory-line" d={curve} />
          {values.map((m, i) => (
            <g
              key={m.id}
              onMouseEnter={() => setSelected(m.id)}
              onMouseLeave={() => setSelected(null)}
            >
              <circle
                cx={x(m.frequencyHz)}
                cy={y(measuredGainDb(m, session.config))}
                r="16"
                fill="transparent"
              />
              <circle
                className="measured-point"
                cx={x(m.frequencyHz)}
                cy={y(measuredGainDb(m, session.config))}
                r={selected === m.id ? 7 : 5}
              >
                <title>{`Reading ${i + 1}: ${formatFrequency(m.frequencyHz)}, ${m.outputVpp} Vpp, ${measuredGainDb(m, session.config).toFixed(2)} dB`}</title>
              </circle>
            </g>
          ))}
        </g>
      </svg>
      <div className="plot-caption">
        <span>
          <i className="legend-line" />
          Calculated ideal response
        </span>
        <span>
          <i className="legend-dot" />
          {demo ? "Example readings" : "Confirmed readings"}
        </span>
      </div>
      <p className="chart-note">
        {active
          ? `${formatFrequency(active.frequencyHz)} · ${active.outputVpp} Vpp · ${measuredGainDb(active, session.config).toFixed(2)} dB`
          : values.length
            ? "Hover over a point to inspect it. All values are also in the notebook."
            : "Your confirmed readings will appear here. The line is a calculation, not a measurement."}
      </p>
    </div>
  );
}
