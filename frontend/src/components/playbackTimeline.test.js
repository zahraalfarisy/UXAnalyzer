import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gazeAt, mouseAt } from './playbackTimeline.js'

test('gaze follows seek in both directions and disappears across tracking gaps', () => {
  const samples = [{ timestamp: 100, gaze_x: 20 }, { timestamp: 100.1, gaze_x: 40 }, { timestamp: 105, gaze_x: 80 }]
  assert.equal(gazeAt(samples, 100.09).gaze_x, 40)
  assert.equal(gazeAt(samples, 105).gaze_x, 80)
  assert.equal(gazeAt(samples, 100).gaze_x, 20)
  assert.equal(gazeAt(samples, 102), null)
  assert.equal(gazeAt([], 100), null)
})

test('cursor uses last known position and never a future sample', () => {
  const samples = [{ timestamp: 100, x: 20 }, { timestamp: 105, x: 80 }]
  assert.equal(mouseAt(samples, 99), null)
  assert.equal(mouseAt(samples, 104).x, 20)
  assert.equal(mouseAt(samples, 105).x, 80)
  assert.equal(mouseAt(samples, 100).x, 20)
})
