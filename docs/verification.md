# Verification record

Checked during development on **18 November 2026**. This record distinguishes observed behaviour, automated checks and work that still needs testing. It is not a general accuracy, accessibility or performance certification.

## Observed browser workflow

The production build was exercised on **localhost and the published GitHub Pages site in desktop Microsoft Edge**. The public deployment at [talayahya.github.io/Benchlog](https://talayahya.github.io/Benchlog/) was verified on 18 November 2026 after GitHub Actions passed its tests, build and deployment. These observations concern that environment; they do not establish support in every browser.

| Check                  | Observed result                                                                                                                                                    | What it establishes                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Bundled audio fixture  | `public/examples/reading.wav` is a synthetic Windows text-to-speech clip saying “At one kilohertz, output one point seven volts.”                                  | The input is a reproducible artificial speech sample, not audio from a physical lab experiment.                          |
| Actual local inference | **How it works > Transcribe the sample on this device** ran the audio through the local Whisper model. The returned text was “At 1 kilohertz, output 1.7 volts.” | Audio-file decoding and real ASR inference worked for this clip. The result was not supplied as a hard-coded transcript. |
| Interpretation         | The result appeared as a pending **1000 Hz / 1.7 Vpp** reading.                                                                                                    | The recognised phrase reached the measurement interpreter with the expected units and values.                            |
| Correction             | The guided correction changed the proposed output to **1.68 Vpp**.                                                                                                 | A supported correction changed the intended field before confirmation.                                                   |
| Confirmation           | Saving the corrected reading updated the notebook and response graph.                                                                                              | The inspected flow kept the reading pending until confirmation and then presented the confirmed result.                  |
| Complete example       | The eight-step guided workflow finished with six saved readings and one note. | The complete synthetic example worked through the visible interface in this environment. |
| CSV export             | The downloaded CSV was opened and inspected. It retained the original 1.7 Vpp phrase and correction to 1.68 Vpp. | The downloaded record included provenance, not only the final value shown in the table. |
| Narrow viewport        | At a 390 × 844 emulated browser viewport, `innerWidth` was 390 and document `scrollWidth` was 375. | No horizontal page overflow was observed at that viewport. This is not a physical mobile-device test. |

The sample route opens an isolated synthetic notebook. The ordinary guided example buttons pass text to the interpreter; they are useful for exploring the command workflow but do not run speech recognition themselves. The audio-fixture route is deliberately separate so reviewers can tell those two kinds of demonstration apart.

The hosted check repeated actual Whisper inference and returned the same transcript, **“At 1 kilohertz, output 1.7 volts.”** Correction to **1.68 Vpp** and confirmation then produced the fifth saved example reading and a new point at **−1.51 dB**. No browser warnings or errors were reported during that check. [Published workflow run](https://github.com/talayahya/Benchlog/actions/runs/44387691058)

An earlier hosted check caught a lifecycle bug: backgrounding the tab cancelled an explicitly requested file transcription. The fix separates file inference from live microphone capture. File transcription now continues while hidden; live capture and read-back still stop, and cancelling or switching notebooks still prevents stale file results from being applied.

## Investigation verification, 19 November 2026

The new investigation was exercised in desktop Edge against the local development build. Each of the three bundled synthetic WAV files passed through the actual local Whisper recogniser, with these observed transcripts:

| Fixture | Recognised transcript | Observed behaviour |
| --- | --- | --- |
| `investigation-anchor.wav` | “At 10 kilohertz, output 31 millivolts.” | Proposed 10000 Hz / 0.031 Vpp, then saved only after confirmation. |
| `investigation-question.wav` | “What would tell these apart?” | Fitted both models to the confirmed anchor and froze an 80 Hz test with predictions 1.7772862244 Vpp and 0.1969815275 Vpp. |
| `investigation-result.wav` | “At 80 Hz, output 1.78 volts.” | Proposed 80 Hz / 1.78 Vpp, then compared it with the frozen predictions only after confirmation. |

The [actual exported JSON](investigation-example.json) preserves the sequence: anchor confirmed at 11:25:14 UTC, predictions created at 11:25:28 UTC, and test reading confirmed at 11:26:29 UTC. Both measurement records are labelled `demo`. The JSON was downloaded through the app's export control; it was not constructed as a substitute for the UI run.

A separate typed synthetic test of **0.8 Vpp at 80 Hz** produced the intended **neither prediction matches** outcome. It did not force a winner. A 390 × 844 responsive check showed readable prediction columns and no page-wide horizontal overflow; the readings table retains its own horizontal scroll. This was viewport emulation, not a physical mobile-device test.

These are three successful synthetic speech fixture checks, not a general speech-accuracy benchmark, live microphone trial, or physical experiment. The video uses edited captures of these checks and explicitly labels the synthetic inputs.

## Automated verification

On **19 November 2026**, the expanded suite passed **128 of 128 tests** across six files using `npm test -- --maxWorkers=1`. The twelve UI tests include the full investigation: pending readings cannot supply evidence, the prediction receipt is unchanged after the test reading arrives, and example data remains isolated from the live notebook. One worker avoids unnecessary peak memory use while the browser speech model is loaded. No test timeouts were increased.

The final version adds a thirteenth UI regression: unsupported or incomplete recognised speech must not advance the guided example, while a valid retry uses its actual recognised values. **All 129 tests and the production build passed in the published GitHub workflow** for commit `aec9056`. [Final code verification and deployment](https://github.com/talayahya/Benchlog/actions/runs/44516453871). The hosted six-step example was checked again after deployment. The published MP4 player reports 140 seconds and 1280 × 720; the local file fully decodes as 3360 frames at 24 fps. Public and downloadable copies have the same SHA-256 hash.

Run the current repository's checks:

```sh
npm test
npm run build
```

All **94 tests passed** in the full-suite check on 18 November 2026. The test suite covers the implemented command engine and speech lifecycle using controlled inputs and mocked browser APIs. Relevant areas include number/unit handling, invalid inputs, pending versus confirmed records, corrections, export behaviour, cancellation and stale callbacks. Three additional regressions check that explicitly requested file transcription continues in the background while live microphone capture stops when the tab becomes hidden. This is a dated result; use the runner output for the current count and result as the suite changes.

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
