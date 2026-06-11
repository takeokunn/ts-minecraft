import { describe, it, expect } from 'vitest'
import { makeJoinMessage } from '../application/server-handlers'
import { MessageType } from '../domain/schemas'

describe('makeJoinMessage', () => {
  it('sets type to PlayerJoin', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.type).toBe(MessageType.PlayerJoin)
  })

  it('sets playerName from the argument', () => {
    expect(makeJoinMessage('Alice').playerName).toBe('Alice')
    expect(makeJoinMessage('Bob').playerName).toBe('Bob')
  })

  it('sets playerId to "pending"', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.playerId).toBe('pending')
  })

  it('sets worldId to "overworld"', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.worldId).toBe('overworld')
  })

  it('sets spawn position to origin-at-y64', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.position).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('sets timestamp to a positive number', () => {
    const msg = makeJoinMessage('Alice')
    expect(typeof msg.timestamp).toBe('number')
    expect(msg.timestamp).toBeGreaterThan(0)
  })
})
