import { useEffect, useRef } from 'react'
import { densityField } from './heatmapDensity'

export default function SmoothHeatmap({ samples, screenWidth, screenHeight, canvasRef }) {
  const radius = 90
  const opacity = .7
  const localRef = useRef(null)
  const ref = canvasRef ?? localRef
  useEffect(() => {
    const canvas = ref.current
    const context = canvas.getContext('2d')
    const width = 640
    const scale = width / screenWidth
    const height = Math.max(1, Math.round(screenHeight * scale))
    canvas.width = width
    canvas.height = height
    const field = densityField(samples.map(g => ({ x: g.gaze_x * scale, y: g.gaze_y * scale })), width, height, radius * scale)
    let max = 0
    for (const value of field) max = Math.max(max, value)
    const pixels = context.createImageData(width, height)
    if (max > 0) {
      for (let i = 0; i < field.length; i++) {
        const value = field[i] / max
        // Green -> yellow -> red, with transparent edges over the actual screen.
        pixels.data[i * 4] = Math.round(Math.min(1, value * 2) * 255)
        pixels.data[i * 4 + 1] = Math.round(Math.min(1, (1 - value) * 2) * 255)
        pixels.data[i * 4 + 2] = 30
        pixels.data[i * 4 + 3] = Math.round(Math.min(1, value * 2) * opacity * 255)
      }
    }
    context.putImageData(pixels, 0, 0)
  }, [samples, screenWidth, screenHeight, radius, opacity])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-label="Smooth gaze density on the current recorded screen" />
}
