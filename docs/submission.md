# Benchlog: project overview

**Voice-assisted electronics experiments**  
Tala Yahya · Project overview

## The problem

When both hands are holding probes and your eyes are on an oscilloscope, stopping to type a measurement breaks the flow. Recording a number also leaves a harder question: what should you test next? Benchlog connects spoken measurements to a small, understandable investigation.

The idea grew from conversations about starting RC circuit experiments and becoming familiar with lab instruments. It is designed for students taking manual measurements, without requiring remotely controllable equipment.

## What the prototype does

A student sets the resistor, capacitor and fixed input amplitude for an RC low-pass filter, then speaks a reading. Benchlog presents the interpreted values for correction and confirmation. Original phrases and corrections remain inspectable. Confirmed measurements appear in a notebook and response plot, with CSV, Markdown and JSON exports.

The question “What would tell these apart?” fits two constrained explanations to a confirmed reading: a changed RC time constant, or a constant amplitude scale. Both fit that first observation, so the app compares their predictions at candidate frequencies and proposes a separating test. A prediction receipt is saved before the next observation. New readings are compared with those fixed predictions, not used to rewrite them.

In the synthetic worked example, 31 mVpp at 10 kHz fits both models. At the proposed 80 Hz test, they predict approximately 1.78 Vpp and 0.197 Vpp. The app can report a match, both, neither or inconsistent repeats. It cannot identify whether resistance or capacitance changed from their product alone.

## Why this approach

Voice helps at the hands-occupied moment; setup, review and exports retain ordinary controls. Browser recognition is available with its processing implications disclosed. Optional on-device Whisper transcribes locally after downloading a model, without an application API key. Typing uses the same interpreter.

Speech recognition is AI. Units, confirmations, fitting and comparisons are deterministic TypeScript. The predictions are explainable, and comparison bands are explicitly illustrative rather than calibrated confidence. Benchlog records reported values; it does not measure or operate the circuit.

## What comes next

The next step is a real bench trial comparing interruptions and corrected errors with a spreadsheet, then testing varied voices and background noise. Synthetic examples and automated tests do not establish physical accuracy or learning gains.

Substantial ChatGPT/Codex development assistance is disclosed in `ai.md`. Setup instructions, tests and a plain-language review guide accompany the source.
