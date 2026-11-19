# Benchlog investigation demo

Completed: **2 minutes 20 seconds**, caption-led with no artificial narrator or music. This is the final two-model investigation story, replacing the earlier cutoff-bracketing storyboard. The paragraphs below explain each scene's meaning; they are not a voiceover. The [final manifest](video/demo-manifest.json) specifies the exact captions, real app captures, crops and three synthetic input audio cues. The exported MP4 is 1280 × 720 at 24 fps.

## Recording and editing

The completed video uses real captures from the running application. This disclosure remains visible throughout:

**Edited app capture sequence · synthetic test voice and readings**

The synthetic audio must pass through the actual local Whisper recogniser. Capture its returned transcript, not a manually substituted result. Label any shortened download or inference wait **Wait shortened**. Do not imply that the edited duration is measured latency.

Use only the actual synthetic input clips as audio where they explain the demonstrated transcription. No generic narrator or background music is needed. Keep real app captures still and readable for most of their duration, with at most a few purposeful crops to make important numbers legible. Avoid invented cursor actions, fake instrument traces or footage suggesting a physical experiment occurred. `scripts/build_demo_video.py` streams the supplied captures into a video; it does not operate or fabricate the application.

## 00:00–00:14 · The question

**Capture:** the actual investigation workspace with the initial circuit setup. Introduce the two possible explanations without showing a conclusion.

**Editorial context:**

A low output doesn't explain itself. Has the filter changed, or is the measurement scaled? Benchlog helps you choose a test that can tell those stories apart, while keeping your hands on the circuit.

## 00:14–00:33 · Speak an observation

**Capture:** start local transcription of the new synthetic audio fixture. Show the actual returned transcript, pending **10 kHz / 31 mV** reading, then confirmation. Show the 2 Vpp configured input.

**Editorial context:**

Here's a repeatable example using synthetic speech and readings. On-device Whisper hears ten kilohertz, output thirty-one millivolts. I check and confirm that interpretation before it enters the notebook. The app records what I report; it does not control an instrument.

## 00:33–00:55 · One reading, two explanations

**Capture:** compare the fitted time-constant model and fitted scale model. Both pass through the original observation. Keep the original reading visible.

**Editorial context:**

That reading fits two explanations. One model has a larger RC time constant. The other keeps the original filter shape but scales the output down. Both are fitted to the same starting observation, so matching it is not evidence that either explanation is right.

## 00:55–01:18 · Decide before measuring

**Capture:** the actual **“What would tell these apart?”** result shows the chosen **80 Hz**, both predictions, assumptions and the receipt automatically saved by the command. The full candidate grid is in the exported JSON, rather than shown as an invented interface element.

**Editorial context:**

I ask what would tell them apart. Benchlog compares their predictions across a bounded set of frequencies and suggests eighty hertz. Here, they predict one point seven eight volts and zero point one nine seven volts. Benchlog automatically saves those predictions before the next reading.

## 01:18–01:40 · Test the prediction

**Capture:** the frozen receipt remains visible. Add and confirm the synthetic **80 Hz / 1.78 Vpp** observation. Show the actual comparison with the saved predictions. Do not regenerate either prediction after this value arrives.

**Editorial context:**

Now I enter one point seven eight volts. The comparison uses the predictions saved earlier, not models refitted to the answer. This result is closer to the larger-time-constant example. The record keeps the original observation, the proposed test and its outcome together.

## 01:40–02:00 · Explain the limit

**Capture:** show the result's assumption and non-identifiability explanation. Then show the actual neither-model outcome for **0.8 Vpp at 80 Hz**, explicitly captioned **Separate synthetic example** so it is not mistaken for the earlier 1.78 Vpp observation.

**Editorial context:**

That still doesn't identify a faulty capacitor. Resistance and capacitance appear as a product in this model, so either could change the time constant. These are two examples, not every possible cause. A result that fits neither should remain unexplained rather than being forced into an answer.

## 02:00–02:20 · Evidence you can inspect

**Capture:** the saved in-app prediction receipt, then the complete result closeup with the live app and repository addresses in the caption. The video does not pretend the receipt is the exported file; reviewers can separately inspect `docs/investigation-example.json`. End on the real app, without fictitious metrics or claims of physical validation.

**Editorial context:**

Benchlog turns a spoken observation into a testable question. Speech recognition uses AI; the predictions and comparisons are transparent code. The repository includes tests, setup instructions and an AI-use disclosure. The next step is trying it at a real bench with students and realistic background noise.

## Mathematics to verify before capture

For the illustrative setup, nominal R = 1000 ohms, C = 100 nanofarads, input = 2 Vpp, and the confirmed seed observation is 0.031 Vpp at 10000 Hz.

- Let g = observed output / configured input = 0.0155.
- Fitted time constant: tau = sqrt(1/g^2 - 1) / (2 pi f), approximately 1.0267 milliseconds.
- Fitted output scale with nominal time constant: scale = g sqrt(1 + (2 pi f R C)^2), approximately 0.098615.
- At 80 Hz the fitted time-constant model predicts approximately **1.777 Vpp**.
- At 80 Hz the fitted scale model predicts approximately **0.19698 Vpp**.
- The synthetic test observation is **1.78 Vpp**.
- The predictions must be frozen before the test observation is committed.
- Do not call the comparison a probability, statistical confidence, calibrated diagnosis or proof of a specific faulty component.
- The choice of 80 Hz depends on the implemented, disclosed candidate grid. Do not claim it is globally optimal.

The three audible clips are the actual synthetic files passed through local Whisper for the captured run: the 10 kHz / 31 mVpp anchor, the comparison question, and the 80 Hz / 1.78 Vpp follow-up. Their video onsets are 15, 34 and 79 seconds. The video is an edited capture sequence, not a continuous recording or a measured latency demonstration.
