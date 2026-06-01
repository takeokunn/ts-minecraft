import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { WorldError, GameLoopError, SettingsError, StartupError, GameStateError } from '../domain/errors'

describe('domain/errors', () => {
  describe('WorldError', () => {
    it('has the correct _tag', () => {
      const err = new WorldError({ worldId: 'world-1', reason: 'some reason' })
      expect(err._tag).toBe('WorldError')
    })

    it('message without position', () => {
      const err = new WorldError({ worldId: 'world-1', reason: 'some reason' })
      expect(err.message).toBe("World error for 'world-1': some reason")
    })

    it('message with position', () => {
      const err = new WorldError({ worldId: 'world-1', reason: 'some reason', position: [1, 2, 3] as const })
      expect(err.message).toBe("World error for 'world-1' at (1, 2, 3): some reason")
    })

    it('is an instance of Error', () => {
      const err = new WorldError({ worldId: 'world-1', reason: 'some reason' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('GameLoopError', () => {
    it('has the correct _tag', () => {
      const err = new GameLoopError({ reason: 'tick failed' })
      expect(err._tag).toBe('GameLoopError')
    })

    it('message without cause', () => {
      const err = new GameLoopError({ reason: 'tick failed' })
      expect(err.message).toBe('Game loop error: tick failed')
    })

    it('message with Error cause', () => {
      const cause = new Error('underlying error')
      const err = new GameLoopError({ reason: 'tick failed', cause })
      expect(err.message).toBe('Game loop error: tick failed: underlying error')
    })

    it('message with non-Error cause', () => {
      const err = new GameLoopError({ reason: 'tick failed', cause: 'some string' })
      expect(err.message).toBe('Game loop error: tick failed: some string')
    })

    it('is an instance of Error', () => {
      const err = new GameLoopError({ reason: 'tick failed' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('SettingsError', () => {
    it('has the correct _tag', () => {
      const err = new SettingsError({ operation: 'load' })
      expect(err._tag).toBe('SettingsError')
    })

    it('message without cause', () => {
      const err = new SettingsError({ operation: 'load' })
      expect(err.message).toBe('Settings load failed')
    })

    it('message with Error cause', () => {
      const cause = new Error('parse error')
      const err = new SettingsError({ operation: 'save', cause })
      expect(err.message).toBe('Settings save failed: parse error')
    })

    it('message with non-Error cause', () => {
      const err = new SettingsError({ operation: 'load', cause: 'bad json' })
      expect(err.message).toBe('Settings load failed: bad json')
    })

    it('is an instance of Error', () => {
      const err = new SettingsError({ operation: 'load' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('StartupError', () => {
    it('has the correct _tag', () => {
      const err = new StartupError({ reason: 'Something went wrong' })
      expect(err._tag).toBe('StartupError')
    })

    it('message without cause', () => {
      const err = new StartupError({ reason: 'Something went wrong' })
      expect(err.message).toBe('Something went wrong')
    })

    it('message with Error cause', () => {
      const cause = new Error('the cause message')
      const err = new StartupError({ reason: 'Something went wrong', cause })
      expect(err.message).toBe('Something went wrong: the cause message')
    })

    it('message with non-Error cause', () => {
      const err = new StartupError({ reason: 'Something went wrong', cause: 'some string' })
      expect(err.message).toBe('Something went wrong: some string')
    })

    it('is an instance of Error', () => {
      const err = new StartupError({ reason: 'Something went wrong' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('GameStateError', () => {
    it('has the correct _tag', () => {
      const err = new GameStateError({ operation: 'initialize', reason: 'body add failed' })
      expect(err._tag).toBe('GameStateError')
    })

    it('message without cause', () => {
      const err = new GameStateError({ operation: 'initialize', reason: 'body add failed' })
      expect(err.message).toBe('GameState error during initialize: body add failed')
    })

    it('message with Error cause', () => {
      const cause = new Error('underlying error')
      const err = new GameStateError({ operation: 'update', reason: 'physics fault', cause })
      expect(err.message).toBe('GameState error during update: physics fault: underlying error')
    })

    it('message with non-Error cause', () => {
      const err = new GameStateError({ operation: 'respawn', reason: 'not initialized', cause: 'missing body' })
      expect(err.message).toBe('GameState error during respawn: not initialized: missing body')
    })

    it('is an instance of Error', () => {
      const err = new GameStateError({ operation: 'initialize', reason: 'body add failed' })
      expect(err).toBeInstanceOf(Error)
    })
  })
})
