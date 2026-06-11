import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { encodeNetworkMessage, decodeNetworkMessage } from '../application/codec'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, PlayerName, WorldId } from '../domain/schemas'
import type { NetworkMessage } from '../domain/schemas'

const pid = PlayerId.make('player-1')
const wid = WorldId.make('world-1')
const pname = PlayerName.make('Steve')
const ts = 1_000

// One representative fixture per message variant in the NetworkMessage union.
const MESSAGES: ReadonlyArray<{ readonly label: string; readonly msg: NetworkMessage }> = [
  { label: 'PlayerJoin', msg: { type: MessageType.PlayerJoin, playerId: pid, playerName: pname, worldId: wid, position: { x: 1, y: 2, z: 3 }, timestamp: ts } },
  { label: 'PlayerLeave', msg: { type: MessageType.PlayerLeave, playerId: pid, worldId: wid, timestamp: ts } },
  { label: 'PlayerMove', msg: { type: MessageType.PlayerMove, playerId: pid, worldId: wid, position: { x: 1.5, y: 64, z: -3.25 }, rotation: { yaw: 0.5, pitch: -0.2 }, timestamp: ts } },
  { label: 'BlockPlace', msg: { type: MessageType.BlockPlace, playerId: pid, worldId: wid, position: { x: 10, y: 20, z: 30 }, blockType: 'STONE', timestamp: ts } },
  { label: 'BlockBreak', msg: { type: MessageType.BlockBreak, playerId: pid, worldId: wid, position: { x: -5, y: 0, z: 7 }, timestamp: ts } },
  { label: 'Chat', msg: { type: MessageType.Chat, playerId: pid, worldId: wid, message: 'hello world', timestamp: ts } },
  { label: 'Ping', msg: { type: MessageType.Ping, nonce: 'abc', timestamp: ts } },
  { label: 'Pong', msg: { type: MessageType.Pong, nonce: 'abc', timestamp: ts } },
  { label: 'Error', msg: { type: MessageType.Error, code: 'E_PROTO', message: 'bad', timestamp: ts } },
]

describe('encode → decode round-trip', () => {
  for (const { label, msg } of MESSAGES) {
    it(`round-trips a ${label} message unchanged`, async () => {
      const decoded = await Effect.runPromise(
        encodeNetworkMessage(msg).pipe(Effect.flatMap(decodeNetworkMessage)),
      )
      expect(decoded).toEqual(msg)
    })
  }

  it('produces a non-empty ArrayBuffer of UTF-8 bytes', async () => {
    const buffer = await Effect.runPromise(encodeNetworkMessage(MESSAGES[0]!.msg))
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
    // the JSON text should be recoverable from the raw bytes
    const text = new TextDecoder().decode(new Uint8Array(buffer))
    expect(text).toContain('PlayerJoin')
  })

  it('slices to the exact message bytes (no shared-buffer tail)', async () => {
    const buffer = await Effect.runPromise(encodeNetworkMessage(MESSAGES[6]!.msg)) // Ping (small)
    const text = new TextDecoder().decode(new Uint8Array(buffer))
    // byteLength must equal the UTF-8 length of the JSON — not a larger backing buffer
    expect(buffer.byteLength).toBe(new TextEncoder().encode(text).byteLength)
  })
})

describe('decodeNetworkMessage error paths', () => {
  const toArrayBuffer = (s: string): ArrayBuffer => {
    const bytes = new TextEncoder().encode(s)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }

  it('fails with a deserialize NetworkError on malformed JSON', async () => {
    const failure = await Effect.runPromise(
      decodeNetworkMessage(toArrayBuffer('{ not json')).pipe(Effect.flip),
    )
    expect(failure).toBeInstanceOf(NetworkError)
    expect(failure.operation).toBe('deserialize')
    expect(failure.reason).toContain('not valid JSON')
  })

  it('fails with a protocol NetworkError on well-formed JSON that violates the schema', async () => {
    // valid JSON, but an unknown message type → passes JSON.parse, fails Schema.decode
    const failure = await Effect.runPromise(
      decodeNetworkMessage(toArrayBuffer(JSON.stringify({ type: 'Nonexistent', timestamp: 1 }))).pipe(Effect.flip),
    )
    expect(failure).toBeInstanceOf(NetworkError)
    expect(failure.operation).toBe('deserialize')
    expect(failure.reason).toContain('does not conform')
  })

  it('rejects a message with a missing required field', async () => {
    // PlayerJoin without playerName
    const partial = JSON.stringify({ type: MessageType.PlayerJoin, playerId: 'p', worldId: 'w', position: { x: 0, y: 0, z: 0 }, timestamp: 1 })
    const failure = await Effect.runPromise(decodeNetworkMessage(toArrayBuffer(partial)).pipe(Effect.flip))
    expect(failure.operation).toBe('deserialize')
    expect(failure.reason).toContain('does not conform')
  })
})
