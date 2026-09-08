import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from '../../src/auth/password.js'
import { isVoiceModelLoaded, loadVoiceModel, predictVoice } from '../../src/ai/voice-model.js'

test('password hashes verify only with the original password', async () => {
  const hash = await hashPassword('correct horse battery staple')
  assert.notEqual(hash, 'correct horse battery staple')
  assert.equal(await verifyPassword('correct horse battery staple', hash), true)
  assert.equal(await verifyPassword('wrong password', hash), false)
})

test('voice model loads and returns bounded explainable predictions', () => {
  loadVoiceModel()
  assert.equal(isVoiceModelLoaded(), true)
  const prediction = predictVoice({ zeroCrossingRate: 0.8, dynamicRange: 0.1, spectralVariation: 0.8 })
  assert.equal(prediction.classification, 'AI Generated')
  assert.ok(prediction.confidenceScore >= 0 && prediction.confidenceScore <= 100)
  assert.ok(prediction.riskScore >= 0 && prediction.riskScore <= 100)
  assert.equal(prediction.reasons.length, 3)
})
