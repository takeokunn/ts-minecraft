import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { PlayerError, CameraError } from '../domain/errors'

describe('domain/errors', () => {
  describe('PlayerError', () => {
    it('has the correct _tag', () => {
      const err = new PlayerError({ playerId: 'p1', reason: 'reason' })
      expect(err._tag).toBe('PlayerError')
    })

    it('message format', () => {
      const err = new PlayerError({ playerId: 'p1', reason: 'reason' })
      expect(err.message).toBe("Player error for 'p1': reason")
    })

    it('is an instance of Error', () => {
      const err = new PlayerError({ playerId: 'p1', reason: 'reason' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('CameraError', () => {
    it('has the correct _tag', () => {
      const err = new CameraError({})
      expect(err._tag).toBe('CameraError')
    })

    it('message without cause', () => {
      const err = new CameraError({})
      expect(err.message).toBe('Camera creation failed')
    })

    it('message with Error cause', () => {
      const cause = new Error('some message')
      const err = new CameraError({ cause })
      expect(err.message).toBe('Camera creation failed: some message')
    })

    it('message with non-Error truthy cause', () => {
      const err = new CameraError({ cause: 'some string' })
      expect(err.message).toBe('Camera creation failed: some string')
    })

    it('is an instance of Error', () => {
      const err = new CameraError({})
      expect(err).toBeInstanceOf(Error)
    })
  })
})
