export type VoicePrediction = 'Genuine' | 'Suspicious' | 'AI Generated'

type ModelFeatures = {
  zeroCrossingRate: number
  dynamicRange: number
  spectralVariation: number
}

export type VoicePredictionResult = {
  classification: VoicePrediction
  confidenceScore: number
  riskScore: number
  reasons: string[]
}

let modelLoaded = false

export function loadVoiceModel(): void {
  // This deterministic baseline is the MVP model adapter. A trained model can replace
  // this implementation without changing the detection endpoint contract.
  modelLoaded = true
}

export function isVoiceModelLoaded(): boolean {
  return modelLoaded
}

export function predictVoice(features: ModelFeatures): VoicePredictionResult {
  if (!modelLoaded) {
    throw new Error('Voice model has not been loaded')
  }

  const syntheticScore =
    features.zeroCrossingRate * 0.45 +
    (1 - Math.min(features.dynamicRange, 1)) * 0.3 +
    features.spectralVariation * 0.25

  const classification =
    syntheticScore >= 0.62 ? 'AI Generated' : syntheticScore >= 0.38 ? 'Suspicious' : 'Genuine'
  const confidenceScore = Math.round(
    Math.min(0.99, 0.55 + Math.abs(syntheticScore - 0.5) * 0.9) * 100,
  )
  const riskScore = Math.round(syntheticScore * 100)
  const reasons: string[] = []

  if (features.zeroCrossingRate >= 0.5) {
    reasons.push('Frequent signal transitions increased the synthetic-voice score.')
  } else {
    reasons.push('Signal transitions stayed within a pattern commonly seen in natural speech.')
  }
  if (features.dynamicRange < 0.35) {
    reasons.push('Low dynamic range suggests unusually uniform vocal energy.')
  } else {
    reasons.push('Vocal energy varies across the recording.')
  }
  if (features.spectralVariation >= 0.35) {
    reasons.push('High spectral variation contributed to the detection risk.')
  } else {
    reasons.push('Spectral variation did not strongly increase the detection risk.')
  }

  return { classification, confidenceScore, riskScore, reasons }
}
