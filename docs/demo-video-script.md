# Benchlog narrated demonstration

The revised film explains one complete investigation in roughly two and a half minutes. It replaces the first static, caption-led edit. The final spoken wording is in [seminar-narration.md](video/seminar-narration.md); the [manifest](video/seminar-manifest.json) derives each scene's length from the recorded narration and input clips.

## Story

| Chapter           | What is explained                                                                                  | What the audience sees                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The question      | A low output is a reading, not an explanation.                                                     | A large 31 mV reading and animated resistor-capacitor schematic.                                                     |
| Speak and confirm | Speech becomes a pending interpretation before it becomes evidence.                                | Actual local-Whisper result, close-up of confirmation and the saved record.                                          |
| Two explanations  | A slower circuit response and a constant scale change can both fit one observation.                | Calculated model curves draw separately through the same 10 kHz / 31 mV point. The input is held at 2 Vpp.           |
| Choose a test     | Look where the two predictions differ, then preserve the predictions before collecting the answer. | The test marker moves to 80 Hz; the predictions are 1.78 Vpp and 0.197 Vpp. Then the actual saved receipt appears.   |
| New evidence      | Compare a new confirmed reading with predictions that were already fixed.                          | The synthetic 80 Hz / 1.78 Vpp input, followed by the actual comparison result.                                      |
| The limits        | Matching one model does not identify which component changed. Neither model may fit.               | R times C explanation and the separately labelled 0.8 Vpp example, which matches neither prediction.                 |
| What's next       | A spoken observation becomes a reason for the next experiment.                                     | Speak, confirm, predict, test; readable prototype/repository links; real student trials as the next validation step. |

## Visual and audio treatment

Actual application captures establish what the prototype does. Educational schematic and curve animations explain why it does it. These two visual sources remain explicitly labelled. Curves are calculated from the implemented equations, not invented instrument traces. Readable teaching statements, sequential reveals and short dissolves connect the ideas.

The narrator is the stock synthetic British SoniaNeural voice, not Tala. The three audible input clips are the same synthetic files successfully passed through local Whisper for the documented application checks. They occupy separate gaps in the narration. Licensed instrumental music is lowered under speech and faded at the ends. Source and licence details are in [credits.md](video/credits.md).

The film is not a continuous live recording or a measured latency demonstration. It does not show a physical circuit trial, calibrated uncertainty, a proven fault, or a world-first method. The opening and recurring footer disclose the synthetic readings and speech.

## Numerical cross-check

Nominal R = 1000 ohms, C = 100 nanofarads, fixed input = 2 Vpp. The confirmed synthetic anchor is 0.031 Vpp at 10000 Hz.

- Anchor gain = 0.031 / 2 = 0.0155.
- Fitted time constant = sqrt(1/gain^2 - 1) / (2 pi f), approximately 1.0267 ms.
- Fitted scale with nominal time constant = gain times sqrt(1 + (2 pi f R C)^2), approximately 0.098615.
- At 80 Hz the first model predicts 1.777286 Vpp; the second predicts 0.196982 Vpp.
- The new synthetic result is 1.78 Vpp. The separate neither-model example is 0.8 Vpp.
- The comparison band is an illustrative engineering rule, not a statistical confidence interval or calibrated instrument uncertainty.
- The selected frequency maximises the implemented difference over a bounded finite grid, not every possible experiment.

## Reproducibility and review

`scripts/build_seminar_video.py` renders the educational graphics and supplied captures, mixes the audio and emits the film. It does not operate or fabricate the app. Source assets, word timings, captions and the edit manifest are retained in `docs/video/`. The watch page supplies captions and chapter navigation. The first 30-second review segment covered a real pending/confirmed capture and the two-curve explanation before the full render.

The review verifies values, labels, frame sequence, audio timing and decoding. Automated audio statistics do not replace a human listening review. Tala should watch and listen to the complete film before submitting it.
