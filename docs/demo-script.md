# Benchlog demonstration plan

Aim for two to three minutes. This is a plan for a live demonstration or an optional recording; it is not a claim that a video has already been recorded. Use the actual running app and say when a step uses synthetic data or typed input.

## Before starting

- Open the app and confirm microphone access works on the demonstration device.
- Use a fresh notebook with the default 1 kΩ, 100 nF and 2 Vpp setup.
- If you plan to use local Whisper, download the model before recording and test a short phrase. Do not present a preloaded model as a measured cold-start result.
- Keep read-back enabled. Wait until it finishes before the next spoken turn.
- For a software-only demonstration, explicitly describe the spoken readings as examples. Do not imply that a connected circuit produced them.
- If recognition is unavailable, show the guided synthetic example or typed phrases and name that fallback honestly.

## 0:00–0:25 · Explain the moment

“Benchlog is a voice notebook for an electronics bench. The idea came from thinking about RC experiments and how to record a reading while both hands are holding probes. It captures what you say, lets you check and correct it, and only saves the measurement once you confirm it. I'm using example readings here, not a live instrument connection.”

Point out the configured components and input. The calculated cutoff should be approximately 1.59 kHz.

## 0:25–1:10 · Capture, correct, confirm

Choose **Start voice session**, select the intended speech mode and start listening.

Say:

> At one kilohertz, output one point seven volts.

Allow the app to read the proposed values back. Point out that the table has not changed yet.

Say:

> Correct output to one point six eight volts.

After the reply, say:

> Save reading.

Show the new row and plot point. Open the record details so the original phrase and correction are visible.

“The recogniser can get a number wrong. That is why a plausible reading is still only a proposal until I confirm it.”

## 1:10–1:45 · Demonstrate a boundary

Say or type, clearly identifying which:

> At two thousand, output one point two four volts.

The frequency has no unit. Show the response instead of claiming the app knew what you meant. Then provide the complete corrected phrase:

> At two kilohertz, output one point two four volts.

Confirm it with:

> Save reading.

“The unit parser is ordinary code. It does not use an LLM to fill in a value that sounds reasonable.”

## 1:45–2:10 · Preserve context and export

Say:

> Note: the output trace looks slightly noisy.

Show **Observations**, return to readings and export the Markdown report or CSV. Explain that the ideal response curve is a calculation and the saved points are the supplied readings. Stop the voice session.

## 2:10–2:40 · Explain the engineering and next step

“Speech recognition is the AI part. After that, the rules check the values and units, keep a pending reading and wait for confirmation. There is also local Whisper, which needs a model download but processes the audio on the device. The notebook is stored in this browser, so exports matter.”

“This was developed with substantial Codex assistance, which is documented in the repository. The next test would be watching students use it in a lab and measuring where recognition, noise or the confirmation flow interrupts them. I haven't claimed a time saving without testing that.”

## If something fails

Keep the failure visible briefly and explain it. A microphone permission error is different from an unrecognised command, and neither should silently create a measurement. Switch to the typed-input path to demonstrate the interpreter, or to **Try example** for a guided synthetic workflow. State which layer the fallback does and does not test.

Do not quote unmeasured accuracy, latency or download-size numbers. Do not describe the guided example as live speech. The source code, reproducible workflow and clear explanation are the evidence.
