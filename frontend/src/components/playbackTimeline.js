// First sample strictly after time; samples arrive in chronological order.
export function upperBound(samples, time) {
  let lo = 0, hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (samples[mid].timestamp <= time) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function gazeAt(samples, time, tolerance = 0.2) {
  const i = upperBound(samples, time)
  const candidates = [samples[i - 1], samples[i]].filter(Boolean)
  const nearest = candidates.sort((a, b) => Math.abs(a.timestamp - time) - Math.abs(b.timestamp - time))[0]
  return nearest && Math.abs(nearest.timestamp - time) <= tolerance ? nearest : null
}

export function mouseAt(samples, time) {
  return samples[upperBound(samples, time) - 1] ?? null
}

export function samplesBetween(samples, start, end) {
  if (end < start) return []
  // Include both boundaries without scanning the entire session.
  let first = upperBound(samples, start)
  while (first > 0 && samples[first - 1].timestamp === start) first--
  return samples.slice(first, upperBound(samples, end))
}
