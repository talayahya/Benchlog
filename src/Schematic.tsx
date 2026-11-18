export default function Schematic() {
  return (
    <svg
      className="schematic"
      viewBox="0 0 260 158"
      role="img"
      aria-label="RC low-pass circuit: input through a resistor, output across a capacitor to common ground"
    >
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="65" r="5" />
        <path d="M29 65H67M111 65h104M67 57h44v16H67zM167 65v30M151 95h32M151 103h32M167 103v21M151 124h32M157 130h20M163 136h8" />
        <circle cx="220" cy="65" r="5" />
      </g>
      <circle cx="167" cy="65" r="3" fill="currentColor" />
      <text x="89" y="45" textAnchor="middle">
        R
      </text>
      <text x="197" y="105">
        C
      </text>
      <text x="12" y="91">
        in
      </text>
      <text x="208" y="91">
        out
      </text>
      <text x="14" y="145" className="schematic-caption">
        Sine-wave input · common ground
      </text>
    </svg>
  );
}
