# A product demonstration that earns its polish

**Historical first-cut direction. Superseded by [the narrated redesign](video-redesign-research.md) after the static treatment did not meet the intended presentation quality.**

Research and editorial decisions, 19 November 2026. This is a short, purposive review of public discussions, not a representative survey. Votes and repeated tool promotion are not evidence of a consensus. The aim is to make the demonstration clear and credible, not to hide the AI assistance documented in `ai.md`.

## What the discussions actually support

| Source                                                                                                                                                    | Observation from the discussion                                                                                                                                                                                                                                                                                                        | Consequence for this demo                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Hacker News: Skill to Create Product Videos](https://news.ycombinator.com/item?id=50340992)                                                              | Several commenters criticised specific defects in an AI-created product video: narration cut off early, an intrusive beat and little meaningful improvement between examples. Other commenters saw useful applications for automation. This is criticism of execution, not proof that an automated editing tool always makes bad work. | Review the finished export, particularly audio endings and pacing. Do not equate added motion or music with improvement. Every edit should make the actual behaviour easier to understand.                     |
| [r/editors: AI-generated Voice Over Trends](https://www.reddit.com/r/editors/comments/17ub0am/aigenerated_voice_over_trends/)                             | Practitioners discussed unsuitable tone, inconsistent pronunciation of technical terminology and synthetic voices that felt inappropriate to the subject. Opinions ranged from rejection to acceptance for temporary or budget-constrained work. This is a 2023 discussion, so it is not a benchmark of present-day speech models.     | An untested generic system narrator adds a quality risk to a numerical, technical demonstration. Use complete editorial captions and the actual sample utterance instead of a continuous SAPI narration track. |
| [r/VideoEditing: screen recordings and zoom quality](https://www.reddit.com/r/VideoEditing/comments/168rs1c/any_method_to_edit_screen_recording_without/) | Replies to a blurry zoomed screen capture recommend capturing at higher native resolution or enlarging the interface during capture. Upscaling does not restore the original detail.                                                                                                                                                   | Use the real full-resolution app captures. Crop sparingly and check the exported interface text at normal playback size. Do not repair illegible UI with fabricated screenshots or synthetic text.             |
| [Hacker News: discussion of a staged AI demonstration](https://news.ycombinator.com/item?id=38559582)                                                     | Commenters distinguish a disclosed mock-up or edited demonstration from footage that implies capabilities or timing which the underlying system did not demonstrate. The thread contains differing opinions and allegations; those allegations are not treated here as verified facts about another product.                           | Label the sequence as an edited capture walkthrough and the test readings as synthetic. Cuts must not imply measured recognition latency, a continuous live session or a connected physical instrument.        |

These are primary sources for people's opinions. They support identifiable concerns, not a universal aesthetic rule or a claim that all viewers dislike synthetic speech. The choices below are our editorial judgement for this particular project.

## Selected treatment

**A roughly 140-second, caption-led walkthrough using real app captures, with a brief audible synthetic test utterance and no continuous narrator or background music.**

The voice interaction must be heard at least once because spoken measurement capture is central to the product. Label that clip **Synthetic test voice**. The recording demonstrates a test fixture being transcribed, not Tala speaking, a live microphone trial or a physical measurement. If the edit is a sequence of screenshots, call it **Edited capture walkthrough**, not a continuous screen recording. A synthetic test voice is appropriate evidence of the audio path; it is not presented as a human endorsement or a voice clone.

The story is the investigation, not a tour of every button:

1. A confirmed example reading is unexpectedly small: 31 mVpp at 10 kHz.
2. Two simple explanations can both reproduce that first reading. One changes the RC time constant; the other scales amplitude across frequencies.
3. Benchlog chooses a discriminating next frequency, freezes both predictions and preserves their source. In this example, 80 Hz produces predictions of about 1.78 Vpp and 0.197 Vpp.
4. A new synthetic reading is transcribed, reviewed and saved. The comparison uses the frozen predictions, so the models cannot quietly change after seeing the answer.
5. Show the outcome and its limit: matching one illustrative model is not a fault diagnosis. End with the receipt or export, the local-ASR distinction and the working project links.

The full numerical flow must come from captured app state. Never draw a result the app did not produce. If the captured run differs from these rounded values, use its actual values.

## Editing rules

- Start with the application and the concrete question in the first few seconds. A brief title is useful; a long logo reveal is not.
- Keep one stable composition with a separate caption area. Match the app's IBM Plex typography and restrained paper, ink, teal and vermilion palette. Do not place captions over the readings or model predictions.
- Use short complete captions, usually one or two lines. Hold dense numerical views long enough to read both predictions and their labels. Six to ten seconds is a starting editorial judgement, not a researched universal timing rule.
- Prefer direct cuts and a few brief dissolves. Limit crop or zoom emphasis to the anchor, competing predictions and outcome. Do not animate a zoom on every click or simulate a cursor path that was never recorded.
- Preserve the instrument-like interface. Avoid floating 3D browser frames, decorative gradients, bouncing words, stock reaction footage and generated lab scenes. These exclusions reflect fit to this technical story, not arbitrary bans on those techniques elsewhere.
- Keep the sample utterance clear and finish it before changing the subject. No repeated whooshes or beat competing with numbers. Silence between meaningful audio moments is deliberate.
- Do not manufacture a live waveform, loading progress or recognition speed. An edited wait is acceptable when the edit is evident and no performance claim is made.

## Acceptance check for the actual export

Watch the entire finished file, not just a contact sheet. Listen to the sample utterance and check that its beginning and ending are intact. Confirm each visible number and caption against the real captured state. Check text at normal playback size, with particular attention to mVpp versus Vpp and kHz versus Hz. Inspect transitions for accidental flashes or clipped labels. The opening disclosure must be readable, not hidden in a one-frame disclaimer. The final links should remain visible long enough to use.

This demo can demonstrate a coherent implemented workflow and careful engineering boundaries. It cannot establish recognition accuracy, real-lab usefulness, physical safety, measured latency or worldwide novelty. Those require separate evidence.
