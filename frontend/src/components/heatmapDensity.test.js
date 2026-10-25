import { test } from 'node:test'
import assert from 'node:assert/strict'
import { densityField, screenChanged } from './heatmapDensity.js'
import { samplesBetween } from './playbackTimeline.js'

test('hotspots fade smoothly and symmetrically, with overlapping gaze adding density', () => {
  const field = densityField([{ x: 10, y: 10 }], 21, 21, 9)
  const at = (x, y) => field[y * 21 + x]
  assert.equal(at(10, 10), 1)
  assert.ok(at(11, 10) > at(12, 10))
  assert.ok(at(12, 10) > at(13, 10))
  assert.equal(at(12, 10), at(10, 12))
  const overlap = densityField([{ x: 10, y: 10 }, { x: 10, y: 10 }], 21, 21, 9)
  assert.equal(overlap[10 * 21 + 10], 2)
})

test('edge gaze is clipped safely; missing or invalid gaze leaves the map clear', () => {
  const edge = densityField([{ x: 0, y: 0 }, { x: NaN, y: 1 }], 20, 20, 9)
  assert.equal(edge[0], 1)
  assert.ok([...edge].every(Number.isFinite))
  assert.ok([...densityField([], 20, 20, 9)].every(v => v === 0))
})

test('time window excludes old screens and future gaze, and works after backward seeks', () => {
  const samples = [1, 2, 3, 4, 5].map(timestamp => ({ timestamp }))
  assert.deepEqual(samplesBetween(samples, 3, 4).map(g => g.timestamp), [3, 4])
  assert.deepEqual(samplesBetween(samples, 1, 2).map(g => g.timestamp), [1, 2])
  assert.deepEqual(samplesBetween(samples, 3.1, 4).map(g => g.timestamp), [4])
  assert.deepEqual(samplesBetween(samples, 5, 4), [])
})

test('large visual changes reset the trail; tiny changes do not', () => {
  const frame = new Uint8ClampedArray([20, 20, 20, 255, 80, 80, 80, 255])
  assert.equal(screenChanged(null, frame), false)
  assert.equal(screenChanged(frame, frame), false)
  assert.equal(screenChanged(frame, new Uint8ClampedArray([22, 22, 22, 255, 80, 80, 80, 255])), false)
  assert.equal(screenChanged(frame, new Uint8ClampedArray([220, 220, 220, 255, 180, 180, 180, 255])), true)
})
