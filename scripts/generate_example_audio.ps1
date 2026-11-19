# Reproducible synthetic speech fixtures, not recordings of a person or lab.
Add-Type -AssemblyName System.Speech
$benchSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$benchSynth.SelectVoice('Microsoft Zira Desktop')
$benchSynth.Rate = -1
$benchAudioDirectory = Join-Path $PSScriptRoot '..\public\examples'
$benchClips = @{
  'investigation-anchor.wav' = 'At ten kilohertz, output thirty one millivolts.'
  'investigation-question.wav' = 'What would tell these apart?'
  'investigation-result.wav' = 'At eighty hertz, output one point seven eight volts.'
}
foreach ($benchClip in $benchClips.GetEnumerator()) {
  $benchSynth.SetOutputToWaveFile((Join-Path $benchAudioDirectory $benchClip.Key))
  $benchSynth.Speak($benchClip.Value)
  $benchSynth.SetOutputToNull()
}
$benchSynth.Dispose()
