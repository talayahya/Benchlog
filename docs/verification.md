# Verification record

Checked during development on **18 November 2026**. This record distinguishes observed behaviour, automated checks and work that still needs testing. It is not a general accuracy, accessibility or performance certification.

## Observed browser workflow

The production build was exercised in **desktop Microsoft Edge**. These observations concern that build and environment; they do not establish that a public deployment or every other browser has been checked.

| Check                  | Observed result                                                                                                                                                    | What it establishes                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Bundled audio fixture  | `public/examples/reading.wav` is a synthetic Windows text-to-speech clip saying “At one kilohertz, output one point seven volts.”                                  | The input is a reproducible artificial speech sample, not audio from a physical lab experiment.                          |
| Actual local inference | **How it works > Transcribe the sample on this device** ran the audio through the local Whisper model. The returned text was “At one kilohertz, output 1.7 volts.” | Audio-file decoding and real ASR inference worked for this clip. The result was not supplied as a hard-coded transcript. |
| Interpretation         | The result appeared as a pending **1000 Hz / 1.7 Vpp** reading.                                                                                                    | The recognised phrase reached the measurement interpreter with the expected units and values.                            |
| Correction             | The guided correction changed the proposed output to **1.68 Vpp**.                                                                                                 | A supported correction changed the intended field before confirmation.                                                   |
| Confirmation           | Saving the corrected reading updated the notebook and response graph.                                                                                              | The inspected flow kept the reading pending until confirmation and then presented the confirmed result.                  |

The sample route opens an isolated synthetic notebook. The ordinary guided example buttons pass text to the interpreter; they are useful for exploring the command workflow but do not run speech recognition themselves. The audio-fixture route is deliberately separate so reviewers can tell those two kinds of demonstration apart.

## Automated verification

Run the current repository's checks:

```sh
npm test
npm run build
```

The test suite covers the implemented command engine and speech lifecycle using controlled inputs and mocked browser APIs. Relevant areas include number/unit handling, invalid inputs, pending versus confirmed records, corrections, export behaviour, cancellation and stale callbacks. The current test count and result should be taken from the runner output, since the suite may change.

Mocked microphone and speech-synthesis tests check the application's reactions to events. They do not measure how well a real microphone captures speech, whether a real browser recognises different voices, or how noisy a laboratory can be before the workflow degrades.

## Local-mode data handling

Local Whisper downloads its model/runtime resources, then processes captured audio on the device. The local voice adapter selects an English synthesis voice only when the browser reports `localService === true`; otherwise the response remains on screen without remote spoken read-back. This describes the implemented selection logic and its tests, not an independently audited guarantee about every browser or operating system.

Browser-speech mode can use a remote recognition provider and is disclosed separately in the interface. A local notebook does not make that speech mode offline.

## Not established by these checks

- No live user microphone trial has been completed. The verified acoustic input was the bundled synthetic file.
- No multi-browser, mobile-device or broad hardware validation is claimed.
- No measured accuracy across voices, accents, speech impairments or lab noise is claimed.
- No cold-start download-size or inference-latency benchmark is claimed.
- No physical RC circuit measurement or comparison with calibrated instruments was performed for this verification.
- No student user study, measured time saving or error-rate reduction is claimed.
- Automated checks and numerical contrast choices do not constitute a complete accessibility audit.

The next useful validation is a small real bench trial: observe the hands-occupied workflow, capture recognition and correction failures, and compare the same task with a spreadsheet. Keep those observations separate from synthetic examples and from the ideal mathematical model.
