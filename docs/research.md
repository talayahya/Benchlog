# Benchlog: research and decisions

Research checked on 18 November 2026. This is a decision record, not a claim that a colour, typeface or implementation has been scientifically proven to be the best choice.

## Product goals and intended users

Benchlog is an independent portfolio project exploring whether spoken capture can make a student's electronics notebook more useful at the bench. Its goals are to preserve confirmed measurements, make corrections inspectable and explain the reason for a follow-up experiment. The public prototype, source, setup instructions and AI-assistance disclosure make those choices available to inspect and test.

The intended user is a student characterising an RC filter. The starting situation comes from work on RC simulations and learning to use lab instruments. It does not imply that a physical validation study of this product has already been carried out.

The useful moment is holding probes and looking at an oscilloscope while recording a reading. A user can say the reading, hear a short interpretation, correct it and confirm it without repeatedly reaching for a keyboard. This is a product hypothesis to test with students, not an established time-saving result. Manual entry remains useful when a lab is noisy, speech recognition fails or a user prefers typing.

The scope stays narrow enough to explain and test: a supported utterance becomes a pending reading, an explicit confirmation adds it to the record, and calculated expectations remain separate from observations. A prospective comparison then asks which next measurement would distinguish two stated mathematical explanations. The usefulness of that complete workflow still needs testing with students.

## Why this experiment

Tektronix's RC lab material asks students to vary the input frequency, inspect output amplitude and phase, and compare observed behaviour with a low-pass filter. Its frequency-response application note describes a resistor-capacitor circuit as a useful example for plotting response across frequencies. Benchlog supports the amplitude-recording part of that workflow; it does not control an oscilloscope or replace its measurements. [Student RC lab](https://download.tek.com/document/Tektronix_Student_Engineering_Lab07_RC_Low_Pass_and_High_Pass_Filter.pdf), [Frequency-response application note](https://www.tek.com/en/documents/application-note/using-frequency-response-analysis-with-an-oscilloscope)

The initial setup is a configurable **1 kΩ resistor, 100 nF capacitor and 2 V peak-to-peak input**. These are modest illustrative defaults, not values from an experiment Tala has already completed. The ideal unloaded model has a time constant of 100 µs and cutoff of about 1.59 kHz. Saved readings and the calculated curve are visually distinct. Real component tolerances, generator impedance, loading and probe configuration can affect the comparison.

Instrument logging and automation already exist. For example, Tektronix offers software for controlling instruments and collecting results. Benchlog's proposed niche is the spoken capture/correct/confirm interaction when a student is using instruments manually, not inventing electronic lab notebooks or automated Bode plots. [TekBench instrument-control software](https://www.tek.com/en/datasheet/control-software-oscilloscopes-and-arbitrary-function-generators)

## Voice architecture and trust

The AI task is automatic speech recognition: turning audio into text. After that, a deterministic interpreter recognises a limited set of commands and units. It does not ask a language model to invent readings, calculate circuit results or guess what an ambiguous unit meant. The tradeoff is a narrower supported vocabulary in return for inspectable, testable behaviour.

The quick-start path uses the browser's speech-recognition service. MDN labels the API as having limited browser availability and notes that some implementations send audio to a remote service. The UI must disclose this rather than call that path offline or wholly private. [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

An optional local Whisper path uses Transformers.js. Hugging Face documents browser inference and automatic speech-recognition pipelines; the first run downloads model resources. Local inference avoids sending captured audio to an application server, but initial model downloads still require a network connection and inference speed depends on the device. No universal latency or recognition-accuracy figure is claimed. [Transformers.js](https://huggingface.co/docs/transformers.js/en/index), [Pipeline and model caching](https://huggingface.co/docs/transformers.js/en/pipelines)

Numeric readings stay pending until confirmed. One-step corrections update the intended value without discarding the rest of a reading, and the transcript/history makes changes inspectable. Google's conversation guidance recommends allowing corrections and reserving explicit confirmation for cases where errors matter. Repeating a confirmation of a simple confirmation would add friction without protecting the data. [Confirmation and corrections](https://developers.google.com/assistant/conversation-design/confirmations)

## Visual direction

The direction is a clear instrument notebook: the active experiment, interpreted reading, response plot and ledger are the content. Small corner radii, strong alignment and purposeful spacing support that structure. They are aesthetic judgments, not a test of whether AI created an interface.

There is widespread practitioner criticism of interchangeable gradient heroes, glass panels, feature-card grids and vague promotional language. This criticism informed the decision to build a useful workspace instead of a marketing template. However, HTTP Archive's analysis did not find statistically significant increases in gradients, shadows or particular fonts, and associated much of the purple-colour pattern with Tailwind's growth. No colour or font reliably proves AI authorship. [Practitioner commentary](https://scalr.sg/blog/20-signs-a-website-was-made-by-ai/), [HTTP Archive analysis](https://almanac.httparchive.org/en/2025/generative-ai)

### Reddit and developer-forum cross-check

Public discussions were checked again on 18 November, including the actual thread text. These are self-selected opinions, not a representative survey or evidence that a particular font determines product quality.

- In a current **r/webdesign** discussion, recurring complaints include redundant small uppercase labels above headings, repeated boxed sections, empty promotional copy and typography that fails to communicate hierarchy. Other participants point out that these patterns existed before AI and can serve a real purpose. The useful test is whether an element earns its space, not whether it appears on a forbidden-style list. [Reddit discussion](https://www.reddit.com/r/webdesign/comments/1xsqm9l/are_there_any_dead_giveaways_of_an_ai_designed/)
- A **Hacker News** discussion about recurring AI designs criticises pages left unedited and repeated card structures, but also notes the long history of ordinary template sameness. This supports reviewing the actual result rather than treating tool choice as a quality test. [Hacker News: repeated AI designs](https://news.ycombinator.com/item?id=50287388)
- Another **Hacker News** thread contains explicit disagreement: some participants see distinctive styling as a signal of care, while others argue that familiar controls and legibility matter more in a useful tool. It also criticises dashboards that repeat the same information in decorative labels. Benchlog keeps familiar table, form and export patterns while making the scientific workflow specific. [Hacker News: utility, legibility and sameness](https://news.ycombinator.com/item?id=48316058)

The desktop screenshot audit found that the circuit schematic, actual gain plot, numeric ledger and correction history were already specific to the product. The remaining weak spots were smaller: a vague “Keep the moment” phrase, unnecessary “Compare as you go” copy above the already clear plot heading, and duplicate example labels. The decision was to simplify those labels while preserving visible synthetic-data disclosure. Changing the palette or font again would not address those problems.

The audit also caught a skip link overlaying the circuit in the captured screenshot. Its hidden state was corrected while retaining keyboard focus visibility, and the final desktop screenshot was checked again. No photograph or decorative illustration is needed to make an engineering notebook look authored. Relevant data and a legible schematic carry more meaning here.

**Typography.** IBM Plex Sans is used for the interface, with IBM Plex Mono for readings and technical values. The shared family gives a coherent relationship between ordinary instructions and precise numbers. IBM documents its technical-diagram usage and the family's natural/engineered design origin. The fonts are bundled under the SIL Open Font License; no IBM branding is used. Body text is at least 16px, with a small, consistent hierarchy and left alignment. [Plex concept](https://www.ibm.com/plex/concept/), [Technical-diagram typography](https://www.ibm.com/design/language/infographics/technical-diagrams/design/), [Font licence](https://github.com/IBM/plex/blob/master/LICENSE.txt)

**Colour.** Cool white surfaces and dark ink keep readings legible. Vermilion draws attention to primary actions; teal identifies saved/measurement information. Labels and shapes must carry the meaning as well as colour. The ratios below were calculated using WCAG relative luminance, not estimated from a screenshot.

| Role                      | Colour    | Contrast against page `#F8FAF8` |
| ------------------------- | --------- | ------------------------------: |
| Main text                 | `#172B32` |                         14.02:1 |
| Secondary text            | `#51646A` |                          5.92:1 |
| Primary action            | `#B73F27` |                          5.33:1 |
| Confirmed / measured      | `#066A63` |                          6.16:1 |
| Essential control outline | `#6F807E` |                          3.95:1 |
| Decorative separator only | `#D3DDDA` |                          1.32:1 |

White text on the primary-action colour is 5.59:1. Pale dividers cannot be the only visible boundary of a control. Meeting these numerical ratios alone does not establish complete accessibility. [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

**Interaction.** Large controls, visible keyboard focus, explicit listening states and text alternatives support use at a bench. Essential buttons aim above WCAG's 24 CSS-pixel minimum, towards the 44px enhanced target. Motion is brief and functional, with reduced-motion support. A graph represents actual saved or explicitly labelled example data, never decorative fake activity. [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Reduced motion](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## What still needs evidence

- Observe whether students actually keep their hands on probes while using it, and where microphone activation interrupts them.
- Test recognition with different voices, accents and realistic lab noise; the current project does not establish fair or reliable performance across those conditions.
- Measure the frequency of wrong units, rejected valid commands and unnecessary confirmations.
- Compare completion time and corrected-error rate with a basic spreadsheet using the same experiment.
- Validate the local model on more devices and browsers before recommending it as a dependable offline workflow.
- Test the circuit workflow in a real lab. Synthetic example readings demonstrate the software, not a physical experiment.

## 19 November: differentiation and the investigation loop

Voice laboratory notebooks are an established category. LabTwin offers spoken scientific notes and tables, protocol prompts, unit-aware data capture and real-time sanity checks. LabVoice offers guided multimodal lab workflows and structured data capture. An open-source LabBuddy project also demonstrates speech-to-structured-protocol extraction and exports. These examples support the existence of the problem, but mean Benchlog should not claim to have invented voice lab documentation or scientific validation. [LabTwin](https://labforward.io/labtwin?hsLang=en), [LabVoice](https://www.labvoice.ai/), [LabBuddy source](https://github.com/abeckDev/LabBuddy-SmartLabProtocollationAssistant)

An earlier option was a narrow RC sweep loop: let a student explicitly choose a confirmed low-frequency reference, find confirmed readings on opposite sides of the half-power target, and suggest a frequency that narrows that bracket. **This option was superseded before the final implementation.** The next two paragraphs preserve its mathematical reasoning as a design record, not a description of a shipped feature.

The target amplitude is the selected reference output divided by the square root of two. The corresponding relative gain is approximately -3.0103 dB. Filter bandwidth levels are defined against a passband reference; using an absolute -3 dB output/input threshold can mislead when insertion loss or loading changes the passband gain. A low-frequency reference approximates the passband and does not calibrate the instruments. [Keysight filter measurement concepts](https://helpfiles.keysight.com/csg/e5080b/Tutorials/Pass-Band_Measurements.htm), [Analog Devices filter-topology guide](https://www.analog.com/en/resources/technical-articles/2022/07/16/07/55/a-beginners-guide-to-filter-topologies.html)

For a bracket with positive endpoints f1 and f2, the geometric midpoint is sqrt(f1 × f2). It lies halfway between them on a logarithmic frequency axis. Any interpolated crossing is an estimate between confirmed points, not a directly observed frequency or a statistical confidence interval. Conflicting repeats or several possible crossings should withhold a unique estimate and prompt another measurement. Component tolerances, probe loading and instrument uncertainty are not inferred from a handful of spoken values. Keeping those limits visible is preferable to adding unsupported calibration or confidence claims.

### Final implementation: two explanations and a prospective test

The implemented extension instead fits two constrained explanations to one confirmed observation, then selects a new test from a bounded frequency grid. One explanation changes the RC time constant; the other keeps the nominal response shape and changes a constant amplitude scale. Both fit the anchor by construction. The app saves their different predictions before a new reading arrives and compares that held-out observation without refitting. Both, neither and inconsistent-repeat outcomes remain possible.

This choice makes the reason for a next measurement visible, while keeping the mathematics small enough to inspect. Voice-based circuit troubleshooting and active test selection have substantial prior art. The [focused prior-art review](investigation-prior-art.md) cites the relevant systems, equations and limits. The claim is a specific, transparent student workflow, not a first-ever algorithm or a validated learning improvement.
