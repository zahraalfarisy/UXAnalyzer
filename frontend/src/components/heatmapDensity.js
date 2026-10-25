// Sum Gaussian kernels before applying colour so nearby fixations form one hotspot.
export function densityField(points, width, height, radius) {
  const field = new Float32Array(width * height)
  const sigma = Math.max(1, radius / 3)
  const extent = Math.ceil(sigma * 3)
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const x0 = Math.max(0, Math.floor(point.x - extent))
    const x1 = Math.min(width - 1, Math.ceil(point.x + extent))
    const y0 = Math.max(0, Math.floor(point.y - extent))
    const y1 = Math.min(height - 1, Math.ceil(point.y + extent))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const distance = (x - point.x) ** 2 + (y - point.y) ** 2
        field[y * width + x] += Math.exp(-distance / (2 * sigma * sigma))
      }
    }
  }
  return field
}

export function screenChanged(previous, current, threshold = 22) {
  if (!previous || previous.length !== current.length) return false
  let difference = 0
  for (let i = 0; i < current.length; i += 4) {
    difference += Math.abs(previous[i] - current[i])
      + Math.abs(previous[i + 1] - current[i + 1])
      + Math.abs(previous[i + 2] - current[i + 2])
  }
  return difference / (current.length / 4 * 3) > threshold
}
