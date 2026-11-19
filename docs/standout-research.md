# Making Benchlog more memorable

Research and editorial critique, **19 November 2026**. This records the original notebook assessment and the conditions for reassessing the later investigation feature. The scores are subjective checkpoints for prioritising improvements to this project, not external ratings or rankings against other products. A conditional target is not a verified final score.

## What the forum evidence actually supports

The useful pattern is **specific understanding made visible**, rather than visual novelty or a longer feature list. These are self-selected discussions about public projects and demonstrations. Comments are evidence of those people's views, not a representative survey or an industry consensus.

1. In **Hacker News' discussion of Show HN becoming crowded**, one recurring criticism is that rapidly generated projects give their authors little to say about the problem itself. The interesting part of a project discussion is the insight gained by spending time on a particular problem. This supports a visible design decision or failure-recovery story, rather than merely mentioning AI use or development speed. [Actual discussion](https://news.ycombinator.com/item?id=47045804)
2. In the **Snapify Show HN discussion**, a reviewer asks to see the central interaction early, understand the product without scrolling, and try it without confusing sign-in barriers. Another reports a video playback issue. For Benchlog, a visible, playable demonstration and a working public prototype matter more than a dramatic introduction. [Actual discussion](https://news.ycombinator.com/item?id=36790947)

As an editorial cross-check, HN's own Show HN guidance asks for something people can try, with a personal reason for making it; it explicitly does not require complexity or slickness. This is guidance for that forum, not a universal measure of software quality. [Show HN guidance](https://news.ycombinator.com/showhn.html)

## Baseline editorial assessment: 77/100 (historical)

This is an intentionally provisional editorial rubric. The weights are editorial judgement; the score is not measured user satisfaction or an independent product evaluation. It assesses the prototype and available evidence at that point in development.

| Criterion                                  |  Weight | Baseline | Reason                                                                                                                                                                                                                               |
| ------------------------------------------ | ------: | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Specific problem and appropriate voice use |      20 |       17 | Taking readings while holding probes is a clear context. The need is plausible, but no actual bench observation has validated the workflow.                                                                                          |
| Voice interaction and recovery             |      20 |       16 | Recognition, explicit confirmation, correction, units and provenance form a complete flow. Spoken language is bounded, and live microphone performance remains untested with users.                                                  |
| Engineering and reviewability              |      20 |       17 | Deterministic interpretation, tests, a worker-based local recogniser, deployment and honest documentation are substantial. At this baseline, the verification record reported 94 passing tests, not general recognition reliability. |
| Distinctive domain value                   |      15 |       12 | An electronics notebook is more specific than a generic assistant. Its main output currently stops at recording and a familiar theoretical-versus-measured plot.                                                                     |
| Presentation and immediate demonstrability |      15 |       12 | The interface and guided example are coherent. There is a genuine local-ASR audio sample, but not yet a finished narrative video showing the complete distinctive benefit.                                                           |
| Evidence beyond synthetic examples         |      10 |        3 | Hosted checks and a real model inference are useful; no live human microphone trial, physical circuit measurement or user study is established.                                                                                      |
| **Total**                                  | **100** |   **77** | **A strong, reviewable prototype with room for deeper experimental judgement and stronger demonstration evidence.**                                                                                                                  |

The most important deficit cannot be fixed by changing fonts: no one has yet shown that this is better than a notebook or spreadsheet at a real bench. That should remain explicit. The app can still be a useful, inspectable portfolio prototype without pretending otherwise.

## Three improvements considered after the baseline

This section records the original critique. The proposed cutoff-bracketing feature below was superseded by the fitted-model investigation described in the reassessment section; it is not a claim that the current app implements that abandoned sweep estimator.

### 1. Turn a recorded sweep into a defensible next experiment

Add a small results view answering **“What does my sweep show, and what should I measure next?”** Keep the existing ideal component-based cutoff separate from any estimate inferred from saved readings. When saved points bracket the relevant response level, report the bracket and a clearly labelled interpolation estimate. When they do not, say that the available data is insufficient and suggest a point that would close the gap. Do not extrapolate a measured cutoff from a single reading or silently assume every circuit has unity passband gain.

This is more useful than adding another dashboard card: it completes a student's loop from recording to choosing an experiment. A concise voice command can expose the same result while hands are occupied. A deterministic method is appropriate and explainable; no new LLM is necessary. Threshold definitions, interpolation assumptions, duplicate frequencies, zero output and non-monotonic results need tests. This particular design is a proposal, not a method prescribed by the forums.

The domain is grounded in real practice: Tektronix describes magnitude/phase sweeps and using their plots to understand circuit behaviour. Benchlog should assist manual investigation, not claim to replace an instrument's frequency-response analyser. [Tektronix application note](https://www.tek.com/en/documents/application-note/using-frequency-response-analysis-with-an-oscilloscope)

### 2. Explain suspicious readings without rewriting the experiment

Make the trust decision visible. A command such as **“Which reading should I repeat?”** could identify the largest difference from the configured ideal response, state the observed and expected values, and suggest checking the setup. It must say that disagreement can come from the real circuit or measurement setup, not just transcription. It must never replace a value with the theoretical answer.

Keep this modest: label it a model discrepancy, not a fault diagnosis or statistical confidence interval. An engineering threshold is an explicitly chosen heuristic, not a probability. Show the original phrase, correction and confirmation alongside the flagged record. Existing correction history provides much of the foundation; the improvement is making its purpose obvious in a real task.

An excellent demonstration deliberately records an implausible value, explains why it deserves a second look, corrects it and shows that the original is still retained. That proves more judgement than an uninterrupted perfect transcript. The mistake must be labelled as a demonstration, not portrayed as a real lab finding.

### 3. Replace promises with a short, inspectable demonstration

Create a 90-150 second video built around one uninterrupted central interaction, rather than a montage of screenshots. Show audio going through the actual recogniser, a proposed value, a correction, confirmation, a changed graph and one useful next-step insight. Use a visibly labelled synthetic clip if that is the available input. Do not imply that clicking scripted example buttons is live voice recognition, that a simulated scope is real hardware, or that edit cuts represent measured inference speed.

Open with the task in one sentence and show the product within the first few seconds. Use close crops and readable captions for the small numbers; keep the original interface visible enough to establish continuity. Show the original and corrected values, then the downloadable record. End with the architectural choice, local processing option and honest next validation step. An attractive title or sound bed can support the story, but cannot substitute for the working interaction.

For stronger reproducibility, add a small labelled set of audio fixtures covering a normal reading, a number correction and an unsupported amplitude convention. Run them through the real model and publish the observed transcripts and acceptance outcomes, including failures. Synthetic fixture checks are engineering evidence, not a speech-accuracy benchmark. The highest-value later addition is a live bench trial with an actual student, followed by one concrete improvement from what happened.

## Conditional reassessment

The final direction is a complete two-model investigation: fit two constrained explanations to a confirmed observation, show a separating test, save predictions before the next reading, then compare without refitting. Its strength is visible experimental reasoning and an inspectable prediction receipt. Neither voice circuit troubleshooting nor active diagnosis is new; the [prior-art review](investigation-prior-art.md) records that boundary.

If the implementation, final checks and honest demonstration are verified, a defensible target under the **same baseline rubric is 84/100**. This remains conditional until that evidence is complete. It replaces the earlier 86-point target; more synthetic examples do not increase the evidence-of-real-use score.

| Criterion                          |    Current | Conditional target |
| ---------------------------------- | ---------: | -----------------: |
| Problem and voice use              |      17/20 |              17/20 |
| Voice interaction and recovery     |      16/20 |              17/20 |
| Engineering and reviewability      |      17/20 |              18/20 |
| Distinctive domain value           |      12/15 |              14/15 |
| Presentation and demonstration     |      12/15 |              15/15 |
| Evidence beyond synthetic examples |       3/10 |               3/10 |
| **Total**                          | **77/100** |         **84/100** |

The evidence score stays low because more synthetic cases and a better video do not create real users or bench results. Voice gains one point for the coherent spoken investigation route; engineering gains one for independently checked fits and evidence-preserving state transitions; domain value gains two for the prospective test; presentation gains three only if the completed video and app actually demonstrate that benefit clearly. A 90-plus score would require stronger actual-use evidence and convincing live operation, not merely more polished packaging. The defensible claim is a distinctive combination tailored to a specific student workflow.

## First-cut editorial assessment: 83/100 (historical)

The finished package was reassessed after the real three-fixture Whisper check, prospective JSON export, alternate neither-model outcome, responsive review and completed 140-second video. Under the same subjective rubric, the result is **83/100**, comprising **17 + 17 + 18 + 14 + 14 + 3**. The final automated count and build result are recorded in [verification.md](verification.md).

The presentation score is **14/15**, one point below the earlier conditional target. The app, write-up and restrained video form a coherent package, but the video is an edited still-capture walkthrough rather than a continuous interaction recording. Some source text is softer than an ideal high-resolution recording. It would be misleading to award perfect presentation solely because the file is finished.

The strongest differentiator is now the complete experimental question: two explanations fit one observation, predictions are fixed, and a new test can leave either, both or neither supported. The next meaningful improvement is real student and bench validation. This score is an editorial assessment, not an external endorsement, a global novelty judgement or a ranking against other products.

## Revision after presentation feedback

The user found the first film too static and unexplained. That is direct evidence that its **14/15 presentation rating was too generous** for the intended audience. Finishing an export and checking its facts did not establish a strong demonstration.

The replacement is a narrated mini-presentation: a concrete opening question, a checked reading, two animated model curves, a separating test, fixed predictions, a new result and an explicit limit. It includes readable teaching labels, meaningful transitions, licensed music, captions and chapter navigation. The [redesign research](video-redesign-research.md) explains the change in direction.

These are substantive presentation improvements, but a higher overall quality score cannot be inferred from them alone. Polished presentation does not create evidence from actual student use. The previous 83-point total is retained as a record of that earlier subjective judgement, not recertified as an objective current score. A final listening and viewing review by the intended presenter is still worthwhile.

## Avoid spending the remaining time on

- Replacing the established typography and palette again without a specific usability problem.
- A generic conversational agent that obscures numeric validation.
- More circuit types, accounts, billing or collaboration before the existing experiment flow is convincing.
- A simulated oscilloscope presented as if the app measures voltage.
- Inflated time-saving, accuracy, accessibility or “first ever” claims.
- A video that hides all recognition delays or uses typed commands while implying live speech.

Sources were selected for relevant discussion and contrasting views, not post counts, promotional success claims or supposed consensus. No new app code was changed as part of this research pass.
