/**
 * api.js — thin wrapper around the FastAPI backend
 */
const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Status
  status:           ()    => req('/status'),

  // Sessions
  listSessions:     ()    => req('/sessions'),
  getSession:       (sid) => req(`/sessions/${sid}`),

  // Calibration
  startCalibration: ()    => req('/calibrate', { method: 'POST' }),

  // Recording
  startRecording:   ()    => req('/record/start', { method: 'POST' }),
  stopRecording:    ()    => req('/record/stop',  { method: 'POST' }),

  // Analysis
  analyzeSession:   (sid) => req(`/sessions/${sid}/analyze`, { method: 'POST' }),
}
