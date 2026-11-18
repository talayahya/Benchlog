# Benchlog

**A voice notebook for the electronics bench**  
Tala Yahya · Hiya Voice AI Challenge · Productivity

## The problem

When both hands are holding probes and your eyes are on an oscilloscope, stopping to type a measurement breaks the flow. A voice memo captures words, but still leaves the work of extracting values and checking units for later. Benchlog turns that moment into a structured notebook entry.

The idea grew from conversations about starting RC circuit experiments and becoming familiar with lab instruments. It is aimed at students taking manual measurements, rather than laboratories that already have full instrument automation.

## What the prototype does

A student sets the resistor, capacitor and fixed input amplitude for an RC low-pass sweep. They say, “At one kilohertz, output one point seven volts.” Benchlog presents the interpreted values and reads them back. “Correct output to one point six eight volts” changes the proposed reading; “save reading” commits it. The original phrase and correction remain inspectable.

Confirmed readings appear in a table and beside the ideal RC response curve. Observations are stored separately, and CSV, Markdown and JSON exports let the student keep a copy. The example notebook is explicitly synthetic and separate from personal records. The app records values supplied by a person; it does not operate instruments or measure the circuit itself.

## Why this approach

Voice is useful at the hands-occupied moment. Setup, review and exports still have ordinary controls, and typing remains available when speaking is inconvenient. The default recogniser uses the browser's speech service, with its audio-processing implications disclosed. Optional on-device Whisper provides an alternative without a transcription API key, after downloading a model.

Speech recognition is AI; the measurement interpreter is deterministic. It requires units, rejects incompatible amplitude conventions and keeps numeric entries pending until confirmation. A limited command vocabulary is a deliberate tradeoff: the prototype favours understandable behaviour over an open-ended assistant that might guess a plausible value. Calculated expectations are clearly separate from recorded readings.

## What comes next

The next step is observing students use it during an actual lab exercise. I would compare interruptions and corrected errors with a spreadsheet workflow, then test different voices and realistic background noise. There are no completed user-study or time-saving claims yet. Further work would improve unsupported-phrase recovery, test local recognition across devices and explore instrument integration where it adds value.

The project was developed with substantial ChatGPT/Codex assistance, disclosed in `ai.md`. The repository includes setup instructions, automated tests and a plain-language architecture guide to support an informed technical review.
