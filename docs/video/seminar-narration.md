# Benchlog seminar demonstration: narration and timing

Produce seven separate, natural spoken clips. Numbers are written for clear pronunciation. The renderer should use their actual duration plus reading pauses and actual input clips. Approximate total: 150 seconds. This replaces the screenshot-only treatment. The video demonstrates synthetic readings, not a physical circuit experiment.

## 01 · A number is not an explanation

You're holding two probes, watching a signal, and trying to keep a useful record. You read a small output. But what does that number mean, and what should you measure next?

## 02 · Voice becomes evidence

Benchlog starts with a spoken reading. This synthetic clip goes through the actual local Whisper model. The interpreted number stays pending, so you can check or correct it before saving. That confirmed observation becomes the starting evidence.

Insert the actual anchor clip before the explanation of its pending state: “At ten kilohertz, output thirty-one millivolts.”

## 03 · Two stories fit

This is a resistor-capacitor filter, with the input held at two volts peak to peak. One explanation is that the circuit responds more slowly. The other keeps the expected response but scales every reading down. Benchlog fits both models to the same starting observation. Explaining a known reading is not the same as predicting a new one.

## 04 · Choose the revealing test

What would tell them apart? The app compares their predictions across a bounded set of frequencies. At eighty hertz, one predicts about one point seven eight volts, and the other predicts zero point one nine seven. Those are very different answers. Benchlog saves the predictions before the next measurement, so the explanation cannot quietly change afterwards.

The short actual question clip may replace the first sentence: “What would tell these apart?” Do not play both simultaneously.

## 05 · Put the prediction to a test

Now comes the new observation. After confirmation, one point seven eight volts is compared with the predictions already saved. It is close to the slower-response model, and far from the scale-only example. The app keeps the original reading, the proposed test and the result together.

Insert the actual result clip before “After confirmation”: “At eighty hertz, output one point seven eight volts.”

## 06 · Keep the unanswered question

That does not prove which component changed. Resistance and capacitance appear as a product, so this model cannot separate them. And these are only two possibilities. In this separate example, neither prediction matches. The app keeps that uncertainty instead of forcing a diagnosis.

## 07 · A reason for the next experiment

This is the idea behind Benchlog: turn a spoken observation into a reason for the next experiment. Speech recognition uses AI; the predictions and comparisons are transparent code. You can inspect the receipt, try the prototype and read the tests. The next step is a real student bench trial.

## Production boundaries

- On-screen disclosure: synthetic test data and voice; actual app captures edited into an illustrated demonstration.
- The explanatory schematic and curves are illustrations calculated from the models, not instrument traces.
- Music: "Signal to Noise" by Scott Buckley, CC BY 4.0, scottbuckley.com.au. Use the No Piano Melody mix as a quiet excerpt, with fades and ducking beneath narration and input clips. Include this credit in the end card and documentation; do not commit the full downloaded track.
- Captions explain the idea, rather than reading long interface paragraphs back to the audience.
- Do not claim live microphone testing, calibrated uncertainty, learning gains or a world-first algorithm.
