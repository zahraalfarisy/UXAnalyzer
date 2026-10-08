import { useState, useEffect } from 'react'
import { api } from '../api'

/**
 * Polls /api/status every 1.5 s.
 * Returns { status, sessionId, error, isRecording, isCalibrating, isAnalyzing }
 */
export function useSystemStatus(pollMs = 1500) {
  const [state, setState] = useState({
    status: 'idle',
    sessionId: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const data = await api.status()
        if (!cancelled) setState({
          status: data.status,
          sessionId: data.session_id,
          error: data.error,
        })
      } catch {
        // backend not running yet
      }
    }
    poll()
    const id = setInterval(poll, pollMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [pollMs])

  return {
    ...state,
    isRecording:   state.status === 'recording',
    isCalibrating: state.status === 'calibrating',
    isAnalyzing:   state.status === 'analyzing',
    isBusy:        state.status !== 'idle',
  }
}
