import { describe, it, expect } from 'vitest'
import {
  createFrameSpikeMonitor,
  FRAME_SPIKE_THRESHOLD_MS,
  MAX_FRAME_SPIKES,
} from '../application/main/debug-frame-spikes'

// Deterministic rAF: frames fire only when we call step(nowMs).
const makeFakeFrameDriver = (startMs: number) => {
  let pending: ((nowMs: number) => void) | null = null
  const perf = {
    nowMs: startMs,
    now: () => perf.nowMs,
    measures: [] as Array<{ name: string; startTime: number; duration: number }>,
    getEntriesByType: (type: string) =>
      type === 'measure' ? perf.measures : [],
  }
  return {
    perf,
    requestFrame: (cb: (nowMs: number) => void) => {
      pending = cb
    },
    step: (nowMs: number) => {
      perf.nowMs = nowMs
      const cb = pending
      pending = null
      if (cb !== null) cb(nowMs)
    },
  }
}

describe('createFrameSpikeMonitor', () => {
  it('records nothing for frames under the threshold', () => {
    const driver = makeFakeFrameDriver(0)
    const monitor = createFrameSpikeMonitor(driver.perf, driver.requestFrame)
    driver.step(16)
    driver.step(32)
    expect(monitor.getSpikes()).toEqual([])
  })

  it('records a spike with timestamp and delta when a frame exceeds the threshold', () => {
    const driver = makeFakeFrameDriver(0)
    const monitor = createFrameSpikeMonitor(driver.perf, driver.requestFrame)
    driver.step(16)
    driver.step(16 + FRAME_SPIKE_THRESHOLD_MS + 30)
    const spikes = monitor.getSpikes()
    expect(spikes).toHaveLength(1)
    expect(spikes[0]?.timeMs).toBe(16 + FRAME_SPIKE_THRESHOLD_MS + 30)
    expect(spikes[0]?.deltaMs).toBe(FRAME_SPIKE_THRESHOLD_MS + 30)
  })

  it('attaches only measures that started within the spiking frame, worst-first', () => {
    const driver = makeFakeFrameDriver(0)
    const monitor = createFrameSpikeMonitor(driver.perf, driver.requestFrame)
    driver.step(16)
    driver.perf.measures = [
      { name: 'frame:old', startTime: 2, duration: 1 },
      { name: 'frame:physics', startTime: 20, duration: 12 },
      { name: 'frame:render', startTime: 30, duration: 55 },
    ]
    driver.step(100)
    const spike = monitor.getSpikes()[0]
    expect(spike?.stages.map((s) => s.name)).toEqual(['frame:render', 'frame:physics'])
  })

  it('caps the spike buffer, dropping oldest first', () => {
    const driver = makeFakeFrameDriver(0)
    const monitor = createFrameSpikeMonitor(driver.perf, driver.requestFrame)
    let t = 0
    for (let i = 0; i < MAX_FRAME_SPIKES + 5; i += 1) {
      t += 100
      driver.step(t)
    }
    expect(monitor.getSpikes()).toHaveLength(MAX_FRAME_SPIKES)
    expect(monitor.getSpikes()[0]?.timeMs).toBe(600)
  })

  it('clear empties the buffer and stop halts rescheduling', () => {
    const driver = makeFakeFrameDriver(0)
    const monitor = createFrameSpikeMonitor(driver.perf, driver.requestFrame)
    driver.step(100)
    expect(monitor.getSpikes()).toHaveLength(1)
    monitor.clear()
    expect(monitor.getSpikes()).toEqual([])
    monitor.stop()
    driver.step(300)
    driver.step(600)
    expect(monitor.getSpikes()).toHaveLength(1)
  })
})
