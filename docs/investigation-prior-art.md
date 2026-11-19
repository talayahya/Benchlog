# Prior-art check: a voice-led circuit investigation

Checked **19 November 2026**. This focused public search informed the implemented investigation: a student speaks a manual measurement; the app displays two constrained circuit explanations, chooses a measurement that separates their predictions, and refuses to identify a fault when the evidence cannot distinguish it. This document records prior art and the mathematical design; the separate verification record describes observed operation.

## Finding

**Neither voice-controlled electronics assistance nor choosing experiments to distinguish competing faults is new.** There is still a potentially distinctive student-facing interaction here, but the search does not establish global novelty. “Never done before” would not be a supportable claim.

The strongest direction is to make experimental uncertainty tangible: **“Both explanations fit this reading. Here is the one measurement on which they disagree.”** The implementation could be unusually transparent and approachable without inventing a new diagnosis algorithm.

## Closest public work

| Work | What its own public source describes | Overlap and remaining distinction |
| --- | --- | --- |
| [PicoAI / PicoMCP](https://www.picotech.com/ai-oscilloscope) | Conversational instrument configuration. PicoAI's first phase is described as a beta for fault-related test guidance and scope setup; waveform analysis is listed as a next phase. | Direct overlap with natural-language lab assistance and recommending what to test. The page does not establish a student-visible comparison of two numerical predictions before a manually reported measurement. Absence from that page is not proof the capability is absent. |
| [Tektronix's AI instrument-control demonstration](https://www.youtube.com/watch?v=hwIYK7mD7zI) | An official demonstration of voice/natural-language requests driving test equipment through an agent and MCP tools. | Voice as a lab interface is already demonstrated by an instrument manufacturer. Benchlog's manual workflow does not require remote-control hardware, but that is a scope choice, not a world-first claim. |
| [CircuitSensei repository](https://github.com/SeunghoCuber/CircuitSensei) | Its README describes microphone input, spoken output, breadboard instructions, camera-based checking and Arduino tests. | Close to a voice-guided student electronics assistant. The README focuses on building and verifying a circuit, rather than the proposed two-explanation experiment. Repository descriptions were inspected; its physical performance was not independently tested. |
| [ScopeAI project](https://devpost.com/software/scopeai) | Its authors describe signal capture through an Analog Discovery 2, extracted features, fault classification and plain-language explanations. | Electronics diagnosis with actual measurements already exists as a hackathon concept. Benchlog should not claim to invent this. ScopeAI's performance claims have not been independently verified here. |
| [Chat Debugging study, Hu and Ash, 2026](https://arxiv.org/abs/2608.02955) | An exploratory analysis of undergraduates' LLM conversations while debugging analog circuits reports useful suggestions alongside unjustified confidence, image-reasoning limitations and gaps in student understanding. | Directly relevant educational problem. Explicit rival predictions and an honest “cannot tell yet” response address a documented concern, but this is a proposed design response, not a demonstrated improvement in learning. |
| [Reiter, A Theory of Diagnosis from First Principles, 1987](https://www.sciencedirect.com/science/article/abs/pii/0004370287900622) | Model-based diagnostic reasoning covering circuits, including measurements that discriminate between competing diagnoses. | The core idea of multiple explanations followed by a discriminating measurement is established prior art. |
| [Feldman, Provan and van Gemund, model-based active testing, 2008](https://llama.gs/papers/feldman08fractal_phm.pdf) | A method for choosing additional inputs/tests to reduce ambiguity among candidate diagnoses, evaluated on combinational circuits. | Choosing an informative next test is also established. A small RC implementation would be an application and explanation of these principles, not a new general algorithm. |
| [Circuit Fix-It Shop, author's AAAI paper, 1997](https://cdn.aaai.org/Symposia/Spring/1997/SS-97-04/SS97-04-030.pdf) | A spoken-dialogue system assisting electronic-circuit repair, evaluated with eight users in 141 problem-solving dialogues. The work discusses dialogue control and mixed initiative. | Direct historical precedent for voice-based circuit troubleshooting. Adding modern speech recognition does not make that broad idea new. |
| [Voice-controlled electronics teaching lab, IEEE 2021](https://pure.ul.ie/en/publications/considering-the-design-and-operation-of-a-voice-controlled-labora/) | A university teaching experiment uses spoken commands, Python and an Arduino-based measurement setup to investigate semiconductor current-voltage behaviour. | Direct precedent for voice interaction in student electronics experiments, although its described task is instrument operation rather than the proposed frozen comparison. |
| [CRESt, MIT, 2023](https://dmse.mit.edu/news/accelerating-research-with-ai-assisted-experiments/) | MIT describes an AI assistant accepting voice commands to control scientific experiments. | Voice-driven experimental assistance also exists outside electronics. Benchlog's narrow, manually operated investigation is a product-scope choice. |
| [Coscientist, Nature, 2023](https://www.nature.com/articles/s41586-023-06792-0) | The research system plans and executes chemistry experiments with tools and analyses experimental results in optimisation tasks. | AI-supported experimental planning and iterative experimentation are established. Benchlog does not claim an equivalent autonomous laboratory. |

## A concrete interaction worth testing

Use a deliberately constrained example: an ideal first-order RC low-pass circuit, output across the capacitor, sine-wave input fixed at **2 Vpp**, nominal **1 kΩ and 100 nF**. Show the assumptions before treating the predictions as meaningful.

Suppose the student confirms **0.031 Vpp at 10 kHz**. The final design fits two deliberately constrained candidate models to that one observation:

- **Model A, changed time constant:** keep unit passband gain and fit the RC time constant. This gives approximately **1.02668 ms**, or **10.2668 times** the nominal 100 µs.
- **Model B, changed output scale:** keep the nominal time constant and fit a constant output multiplier. This gives approximately **0.098615**.

Both models match the initial observation by construction. That agreement is not independent evidence for either model. The memorable interaction is to display their different predictions for a new test, freeze those predictions, and only then collect a new observation.

The following values are calculations, not real measurements:

| Requested frequency | Model A: fitted time constant | Model B: fitted output scale |
| --- | ---: | ---: |
| 10 kHz, fitting observation | 0.031 Vpp | 0.031 Vpp |
| 80 Hz, proposed new test | 1.77729 Vpp | 0.196982 Vpp |

The app can say: **“Both explanations fit your first reading. At 80 hertz, one predicts about 1.78 volts and the other about 0.197 volts. That test would separate them.”** A synthetic new observation of **1.78 Vpp at 80 Hz** is much closer to the saved Model A prediction. The comparison must use the frozen predictions rather than refitting to the new answer. The result is a closer match among two examples, not proof of a physical cause.

The predictions follow the first-order magnitude model, `Vout = Vin × scale / sqrt(1 + (2πfτ)²)`, where `τ = RC`. If `g = observed output / configured input`, Model A fits `τ = sqrt(1/g² - 1) / (2πf)`, while Model B fits `scale = g × sqrt(1 + (2πfτ_nominal)²)`. These values were independently checked with ordinary numerical calculations. Invalid fitting conditions need to be rejected rather than coerced into a model.

Candidate selection uses a transparent finite frequency grid, not a claim of globally optimal experiment design. The selected default 80 Hz is a rounded low-frequency candidate near one twentieth of the nominal calculated cutoff. The receipt should retain the source observation, fitted parameters, proposed frequency, both predictions and the disclosed assumptions before the test observation arrives. Any comparison tolerance is an explicit engineering choice, not a statistical confidence interval or a verified instrument specification.

## The essential refusal case

An increase in resistance and the same proportional increase in capacitance produce the same ideal RC product. Their frequency-response curves are identical under this model. A frequency sweep alone therefore cannot identify which component changed. Benchlog should say so and ask for a different kind of evidence, rather than produce a confident component diagnosis.

Likewise, an incorrect source-amplitude assumption and a constant display-scale error may remain indistinguishable from output amplitude alone. Two candidate models are not an exhaustive account of everything that can go wrong. A reading that matches neither should remain **unexplained**, not be assigned to the less-wrong candidate.

For a first demonstration, this should be a clearly labelled synthetic investigation. No hardware action should be performed automatically. Limit the supported experiment and its assumptions instead of promising general circuit debugging.

## What could fairly be claimed

- A voice-led, evidence-preserving investigation for a narrowly specified student RC experiment.
- Two numerical predictions shown before the next observation, so the user can understand why that measurement was requested.
- A visible distinction between a plausible model and a proven physical cause.
- Local speech processing as an option, deterministic calculations and preserved original/corrected readings.
- Explicit cases where the system says the available experiment cannot distinguish the explanations.

These constitute a product combination and interaction design worth evaluating. This search did **not** find an exact public match for all of them together in a manual, browser-based RC teaching tool. That limited search result is not evidence that no such tool exists. Private work, unpublished student projects, patents and other languages were not comprehensively searched.

## Recommendation

If pursuing this direction, build one complete, honest investigation rather than adding a generic chat assistant or claiming an autonomous lab. The memorable moment should be the app acknowledging that it cannot decide yet, choosing a revealing test and explaining how the result changes the evidence. It is a stronger differentiator than another styling pass, while remaining understandable enough for Tala to explain and extend.

The baseline 77/100 assessment concerns the earlier notebook prototype. The later investigation should receive a final reassessment only after its calculations, refusal cases, voice flow and demonstration have been verified. The [assessment record](standout-research.md) keeps a conditional target separate from a completed evaluation.
