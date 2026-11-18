# Understanding Benchlog

This is a study guide for Tala's Hiya review. It explains the design in ordinary language and gives a short demonstration plan. It is not a script for claiming unaided authorship. AI assistance is recorded in `../ai.md`; understand and test the behaviour before discussing it as your work.

## The idea in a few sentences

Benchlog records electronics measurements by voice. The intended user has both hands occupied with probes and is looking at an oscilloscope. They say a reading, check what the app understood, correct it if necessary and confirm it. The reading is then added to a table and compared with the expected response of a simple RC filter.

The connection to your interests is straightforward: you have been learning about RC circuits and lab instruments, and you wanted a concrete experiment to start with. This project applies that context to a small voice workflow. It does not claim that you have already run a physical user study or built an automated measurement instrument.

## What each part does

### 1. The microphone and speech recognition

The microphone produces audio. Speech recognition turns that audio into words. This is the AI part: a trained model estimates which words best match the sound.

The default path uses the speech-recognition feature exposed by a compatible browser. It needs permission to use the microphone, and the browser may process the audio through a remote recognition service. Therefore, “the notebook is stored on this device” does not mean every speech mode is offline.

The optional local path downloads a Whisper model and uses Transformers.js to run it in the browser. There is no application API key. The initial model download needs an internet connection, and larger or slower devices can take different amounts of time. A cached model can reduce subsequent download work, but cache availability must not be promised indefinitely.

For spoken replies in local mode, Benchlog only chooses an English voice that the browser reports as local. If one is unavailable, the text response stays visible and the next listening turn can continue without spoken read-back. This avoids quietly choosing a remote voice in a mode described as local. The ordinary browser-speech mode depends on the browser and operating system's voice services.

The local path runs the model inside a **Web Worker**, a separate browser execution thread, so the main interface is not doing all of the model's calculations itself. The recording is decoded and converted to one audio channel at 16,000 samples per second before transcription. Here, a sample is one numerical value describing the sound waveform at one instant. This is different from the electronics measurements saved in the notebook. Local clips are bounded to 30 seconds and 10 MB; that limits accidental long recordings and processing work. The English-only tiny model keeps the scope modest, but its accuracy still needs testing with the intended users.

Neither recogniser guarantees correct numbers or units. “One hundred millivolts” and “one hundred volts” are very different readings, so the next stage must not blindly trust the transcript.

### 2. The interpreter

The interpreter is ordinary code with rules. It looks for supported instructions, numbers and units in the recognised text. For example, “one kilohertz” can become the numeric value 1000 in hertz.

It does not use a language model to fill gaps or invent a plausible measurement. If a command is missing a required value or unit, the appropriate response is to ask for that detail or leave the reading incomplete. This means it cannot understand every possible sentence. That is an intentional limit for a prototype handling numeric records.

**ASR** means automatic speech recognition. **Deterministic** means the same input and the same state produce the same result. AI transcription can make different mistakes in different conditions, but a deterministic interpretation layer can be tested with exact examples.

### 3. Pending readings and confirmation

A parsed reading is a proposal. It is kept separate from the saved notebook until the user confirms it. The interface shows the values and can read them back aloud.

This separation is important because seeing a plausible number in a table can make it look authoritative. The confirmation step gives the user a chance to catch a mistake before the value affects the saved record and plot.

Corrections should change the intended field while retaining the rest. The source transcript and correction history explain where a record came from. This history is useful provenance, meaning evidence of the record's origin, but it is not a tamper-proof scientific audit trail.

The input voltage belongs to the experiment setup. If a spoken input differs from that setting, the program asks for a setup change instead of silently accepting a contradictory ratio. To correct an already saved last reading, use “undo last reading” to bring it back into review, then change it and confirm again. This makes a saved-data change explicit.

### 4. The RC calculations

An RC low-pass filter contains a resistor and a capacitor. In this simple model, the output is across the capacitor. It passes low-frequency signals more strongly and reduces higher-frequency signals.

The initial values are:

- Resistance `R = 1 kΩ = 1000 Ω`.
- Capacitance `C = 100 nF = 0.0000001 F`.
- Input amplitude `Vin = 2 Vpp`, where Vpp means peak-to-peak volts.

The **time constant** is:

```text
τ = R × C
  = 1000 × 0.0000001
  = 0.0001 seconds
  = 100 microseconds
```

The **cutoff frequency** is:

```text
fc = 1 / (2πRC)
   ≈ 1591.55 Hz
   ≈ 1.59 kHz
```

Cutoff is not a sharp point where the output becomes zero. For this ideal filter, the output amplitude at cutoff is about 0.707 times the input, corresponding to approximately -3.01 dB.

For a particular frequency `f`, the ideal amplitude ratio is:

```text
expected gain = 1 / √(1 + (2πfRC)²)
expected output = input amplitude × expected gain
```

For a captured reading:

```text
measured gain = output amplitude / input amplitude
gain in dB = 20 × log10(measured gain)
```

For example, an output of 1.6 Vpp with an input of 2 Vpp gives a ratio of 0.8 and about -1.94 dB. Both amplitudes must use the same convention. Do not mix an RMS value with a peak-to-peak value. A zero output also needs special handling because the logarithm of zero is not a finite number.

The curve is a calculation, not a measurement. It assumes an ideal unloaded circuit. Actual component values, source resistance, the oscilloscope/probe setup and other loading can change the real response. A discrepancy is a reason to investigate, not proof that the student or the software is wrong.

An optional phase value records how far the output wave is shifted relative to the input, expressed in degrees. For this ideal low-pass circuit, the output lags the input, and the ideal phase at cutoff is -45°. The notebook can retain a spoken phase reading, but recording that value does not mean the app measured phase itself.

### 5. The interface

React describes what appears on the page from the current application state. TypeScript adds checks for expected shapes of data, such as a reading containing numeric frequency and voltage fields. It can catch many programming mistakes before the app runs; it does not prove a spoken reading is correct.

The interface gives the active task most of the space: the experiment, current interpretation, graph and notebook. IBM Plex Sans carries ordinary instructions, and the related Mono face makes technical values visually distinct. The palette was checked for text contrast. These are deliberate design decisions, not a guarantee that every accessibility issue has been solved.

Vite provides the development server and builds the deployable web assets. The recogniser, interpreter, experiment calculations and interface are distinct concerns so their behaviour can be checked separately.

Read-back and listening take turns. This is called **half-duplex** operation: while the app speaks its interpretation, recognition is paused so it does not capture its own voice as a new command. This is an engineering compromise. It prevents a feedback loop, but a person speaking over the read-back may need to repeat themselves afterwards.

### 6. Storage and export

The saved notebook lives in this browser on this device. That avoids requiring an account or sending readings to an application database. It also means that clearing browser storage, using private browsing or moving to another browser can lose access to the saved session.

Exports give users a copy outside the browser. CSV is useful in a spreadsheet. Markdown is readable text for a report or repository. Exported content should preserve units and distinguish interpreted measurements from notes and calculated expectations. The app's local storage is not a substitute for a backup.

### 7. The example mode

The guided example data makes it possible to explore the command workflow without a microphone or real circuit. Its buttons send example text to the interpreter. It is synthetic and must stay labelled as an example. By itself, this checks the interface and command flow, not speech recognition.

There is also a separate **real recognition test**: open **How it works** and choose **Transcribe the sample on this device**. This takes the bundled `public/examples/reading.wav` recording, made with Windows text-to-speech, and actually runs it through local Whisper. It opens a separate example notebook so it does not mix those values with personal measurements.

That fixture was checked in desktop Edge against the production build. Whisper produced “At 1 kilohertz, output 1.7 volts.” The app showed a pending 1000 Hz / 1.7 Vpp reading. The guided correction changed it to 1.68 Vpp, and confirmation added it to the table and graph. That is useful evidence that audio decoding, model inference, interpretation and confirmation work together for this sample. It does not prove live microphone accuracy, performance across accents, a physical experiment or a time saving.

## Where to look in the source

| File                    | Plain-language purpose                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/engine.ts`         | Recognises supported commands, validates values, changes notebook state, calculates gains and makes exports. |
| `src/voice.ts`          | Connects the browser recognition service to the app and manages spoken read-back.                            |
| `src/localSpeech.ts`    | Prepares audio, sends it to the local model worker and returns text or a useful error.                       |
| `src/whisper.worker.ts` | Downloads and runs the local speech model away from the main interface thread.                               |
| `src/localVoice.ts`     | Handles microphone capture for the local speech route.                                                       |
| `src/storage.ts`        | Reads and writes the saved notebook and triggers downloadable exports.                                       |
| `src/Plot.tsx`          | Draws the calculated response and saved measurements.                                                        |
| `src/Schematic.tsx`     | Shows the circuit arrangement and its configured values.                                                     |
| `src/App.tsx`           | Connects the controls, notebook state, speech paths and visible feedback.                                    |
| `tests/`                | Contains executable examples of expected behaviour and failure cases.                                        |

## Choices an engineer may ask about

**Why voice?** The main moment is holding probes while reading an instrument. A keyboard is useful for setup and edits, but it interrupts this specific hands-occupied task.

**Why not just transcribe a voice memo?** A memo leaves someone to extract the frequency and voltages later. Benchlog structures those fields, supports a correction before saving and calculates the resulting ratio. The narrow structured workflow is the product.

**Why not use an LLM for everything?** General conversation is not necessary to record a few numeric fields. Rules make accepted commands inspectable and allow exact tests. The cost is limited phrasing. A future language model could suggest an interpretation, but it should still pass validation and confirmation before changing a scientific record.

**Is this really AI?** Yes, the speech recognition uses trained models. The downstream parser and calculations are conventional deterministic code. The project does not claim to have trained a new speech model or a general-purpose agent.

**Why confirm a reading?** Numbers and units matter. A misheard value can look reasonable and contaminate a plot. Confirmation adds a little friction in exchange for a clear boundary between heard text and accepted data.

**Why offer two speech paths?** Browser recognition gives a simpler initial experience when supported. Local Whisper offers an alternative without a hosted transcription API, but introduces a model download and device-dependent processing. Neither is universally better.

**Why no login or cloud database?** They are unnecessary for the single-user prototype and would add account management and data-handling work. Cross-device collaboration is a possible later feature, not an implied capability now.

**What did AI do?** Read the actual `ai.md` and describe that involvement accurately. The invitation welcomes AI assistance. The review is an opportunity to show that you understand the resulting code and can identify its limitations, rather than memorise an impressive-sounding explanation.

## Failure cases to understand

- Microphone access denied: offer a useful explanation and manual entry, without repeatedly requesting permission.
- Unsupported browser or unavailable recognition service: use the alternative path or typing; do not pretend that recording succeeded.
- Model download fails: report the failure and retain the notebook.
- Wrong number or unit: allow correction before saving; do not use a model-generated guess as a measurement.
- Duplicate recognition result: avoid creating two saved rows from one intended confirmation.
- Speech continues during read-back: the implementation must avoid accidentally interpreting its own spoken response as a user command.
- Unrecognised instruction: explain the supported format; do not invent an action.
- Browser storage unavailable or full: make the save problem visible and give an export path where possible.
- Synthetic example mode: never describe those readings as a real experiment.

These are engineering cases to inspect in the code and exercise in the app. Do not say all are verified merely because they appear in this list.

## Tests and what they can tell you

Run `npm test` to see the actual automated checks and `npm run build` to check compilation and production output. Quote the real output when asked, not a remembered test count.

Useful checks cover number/unit conversion, invalid or missing fields, correction without losing unrelated fields, confirmation versus pending state, duplicate handling, correct RC calculations and exports. A unit test sends controlled input to one part of the program and checks the result. An interaction test can check the relationship between a user's action and what appears on screen.

Passing parser tests does not prove that a microphone recognises an accent in a noisy lab. That needs speech trials. The actual synthetic-file transcription check is stronger evidence than a mocked transcript, but still covers one clip and one desktop browser. Microphone lifecycle tests use mocks, and no live user microphone trial has been completed. Passing a build does not prove that a deployed page works in every browser. A real circuit experiment is a separate validation step again. See [verification.md](verification.md) for the specific checks and their boundaries.

## A two-to-three-minute demo

1. **First 20 seconds:** explain the hands-occupied situation and show the RC setup. State that the prototype records human-read measurements; it does not control the instruments.
2. **Next 40 seconds:** start recognition and say a supported reading. Show the transcript and pending values. Deliberately correct the output voltage, then confirm the reading.
3. **Next 30 seconds:** show how the saved value appears in the table and on the plot. Point out the distinction between the ideal curve and recorded points.
4. **Next 30 seconds:** show the correction/source history and export a record. Explain why a reading remains pending until confirmed.
5. **Final 30 seconds:** identify the ASR/rules boundary, disclose AI assistance and explain the next real test: observe students using it at the bench, with different voices and realistic noise.

Use live speech if it works on the demonstration device. If you switch to a typed or synthetic example, say so plainly. A reliable explanation of a limitation is stronger than presenting a scripted simulation as live recognition.

For a microphone-free demonstration of the model itself, use **Transcribe the sample on this device** and say: “This is synthetic speech, but Whisper is transcribing the audio here. It isn't a transcript that was hard-coded into the example.” Then demonstrate correction and confirmation. This describes the tested route accurately without claiming a live microphone test.

## What to learn before the review

Be able to trace one sentence through audio, transcript, parsed values, pending state, confirmation, storage and export. Change one component value and explain why the expected curve moves. Try an ambiguous command and observe what the app actually does. Open one parser test, one state transition and one calculation and describe them in ordinary language. Then choose one improvement you would make next and explain how you would test whether it helped.
