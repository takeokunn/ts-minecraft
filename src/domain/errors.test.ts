import { describe, it, expect } from 'vitest'
import { it as effectIt } from '@effect/vitest'
import { Array as Arr, Effect, Equal, HashSet } from 'effect'
import {
  TextureError,
  BlockError,
  MeshError,
  PlayerError,
  WorldError,
  GameLoopError,
  StorageError,
  ChunkError,
  SettingsError,
  StartupError,
  CameraError,
} from '@/domain/errors'

describe('TextureError', () => {
  it('has _tag === "TextureError"', () => {
    const err = new TextureError({ url: 'test.png' })
    expect(err._tag).toBe('TextureError')
  })

  it('message includes the url', () => {
    const err = new TextureError({ url: 'textures/stone.png' })
    expect(err.message).toContain('textures/stone.png')
  })

  it('message is a non-empty string', () => {
    const err = new TextureError({ url: 'test.png' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('message includes cause message when cause is an Error', () => {
    const cause = new Error('network timeout')
    const err = new TextureError({ url: 'test.png', cause })
    expect(err.message).toContain('network timeout')
  })

  it('message includes cause string when cause is a plain string', () => {
    const err = new TextureError({ url: 'test.png', cause: 'HTTP 404' })
    expect(err.message).toContain('HTTP 404')
  })

  it('message does not include colon suffix when cause is absent', () => {
    const err = new TextureError({ url: 'test.png' })
    expect(err.message).toBe('Failed to load texture from test.png')
  })
})

describe('BlockError', () => {
  it('has _tag === "BlockError"', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'invalid' })
    expect(err._tag).toBe('BlockError')
  })

  it('message includes blockType', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'invalid operation' })
    expect(err.message).toContain('STONE')
  })

  it('message includes reason', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'out of bounds' })
    expect(err.message).toContain('out of bounds')
  })

  it('message includes position coordinates when position is provided', () => {
    const err = new BlockError({ blockType: 'DIRT', reason: 'invalid', position: [1, 2, 3] })
    expect(err.message).toContain('1')
    expect(err.message).toContain('2')
    expect(err.message).toContain('3')
  })

  it('message does not include position string when position is absent', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'invalid' })
    expect(err.message).not.toContain('at (')
  })

  it('message is a non-empty string', () => {
    const err = new BlockError({ blockType: 'GRASS', reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('MeshError', () => {
  it('has _tag === "MeshError"', () => {
    const err = new MeshError({ reason: 'vertex overflow' })
    expect(err._tag).toBe('MeshError')
  })

  it('message includes reason', () => {
    const err = new MeshError({ reason: 'vertex buffer too large' })
    expect(err.message).toContain('vertex buffer too large')
  })

  it('message includes details when provided', () => {
    const err = new MeshError({ reason: 'failed', details: 'extra detail info' })
    expect(err.message).toContain('extra detail info')
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new MeshError({ reason: 'failed', cause: new Error('GPU out of memory') })
    expect(err.message).toContain('GPU out of memory')
  })

  it('message is a non-empty string', () => {
    const err = new MeshError({ reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('PlayerError', () => {
  it('has _tag === "PlayerError"', () => {
    const err = new PlayerError({ playerId: 'player-1', reason: 'not found' })
    expect(err._tag).toBe('PlayerError')
  })

  it('message includes playerId', () => {
    const err = new PlayerError({ playerId: 'player-abc', reason: 'not found' })
    expect(err.message).toContain('player-abc')
  })

  it('message includes reason', () => {
    const err = new PlayerError({ playerId: 'p1', reason: 'Player already exists' })
    expect(err.message).toContain('Player already exists')
  })

  it('message is a non-empty string', () => {
    const err = new PlayerError({ playerId: 'p1', reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('message matches format: "Player error for \'<id>\': <reason>"', () => {
    const err = new PlayerError({ playerId: 'p1', reason: 'not found' })
    expect(err.message).toBe("Player error for 'p1': not found")
  })
})

describe('WorldError', () => {
  it('has _tag === "WorldError"', () => {
    const err = new WorldError({ worldId: 'world-1', reason: 'not initialized' })
    expect(err._tag).toBe('WorldError')
  })

  it('message includes worldId', () => {
    const err = new WorldError({ worldId: 'my-world', reason: 'corrupt' })
    expect(err.message).toContain('my-world')
  })

  it('message includes reason', () => {
    const err = new WorldError({ worldId: 'w1', reason: 'failed to load' })
    expect(err.message).toContain('failed to load')
  })

  it('message includes position when provided', () => {
    const err = new WorldError({ worldId: 'w1', reason: 'test', position: [10, 20, 30] })
    expect(err.message).toContain('10')
    expect(err.message).toContain('20')
    expect(err.message).toContain('30')
  })

  it('message does not include position string when position is absent', () => {
    const err = new WorldError({ worldId: 'w1', reason: 'test' })
    expect(err.message).not.toContain('at (')
  })

  it('message is a non-empty string', () => {
    const err = new WorldError({ worldId: 'w1', reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('GameLoopError', () => {
  it('has _tag === "GameLoopError"', () => {
    const err = new GameLoopError({ reason: 'frame drop' })
    expect(err._tag).toBe('GameLoopError')
  })

  it('message includes reason', () => {
    const err = new GameLoopError({ reason: 'rAF not available' })
    expect(err.message).toContain('rAF not available')
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new GameLoopError({ reason: 'crash', cause: new Error('out of memory') })
    expect(err.message).toContain('out of memory')
  })

  it('message is a non-empty string', () => {
    const err = new GameLoopError({ reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('message starts with "Game loop error:"', () => {
    const err = new GameLoopError({ reason: 'frame timeout' })
    expect(err.message).toMatch(/^Game loop error:/)
  })
})

describe('StorageError', () => {
  it('has _tag === "StorageError"', () => {
    const err = new StorageError({ operation: 'saveChunk' })
    expect(err._tag).toBe('StorageError')
  })

  it('message includes operation name', () => {
    const err = new StorageError({ operation: 'saveChunk' })
    expect(err.message).toContain('saveChunk')
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new StorageError({ operation: 'saveChunk', cause: new Error('disk full') })
    expect(err.message).toContain('saveChunk')
    expect(err.message).toContain('disk full')
  })

  it('message includes cause string when cause is a plain string', () => {
    const err = new StorageError({ operation: 'loadWorld', cause: 'IndexedDB quota exceeded' })
    expect(err.message).toContain('IndexedDB quota exceeded')
  })

  it('message is a non-empty string', () => {
    const err = new StorageError({ operation: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('message matches format: "Storage operation \'<op>\' failed"', () => {
    const err = new StorageError({ operation: 'saveChunk' })
    expect(err.message).toBe("Storage operation 'saveChunk' failed")
  })
})

describe('ChunkError', () => {
  it('has _tag === "ChunkError"', () => {
    const err = new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'not found' })
    expect(err._tag).toBe('ChunkError')
  })

  it('message includes chunk coordinates', () => {
    const err = new ChunkError({ chunkCoord: { x: 3, z: -5 }, reason: 'out of bounds' })
    expect(err.message).toContain('3')
    expect(err.message).toContain('-5')
  })

  it('message includes reason', () => {
    const err = new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'chunk not loaded' })
    expect(err.message).toContain('chunk not loaded')
  })

  it('message includes local position when localPosition is provided', () => {
    const err = new ChunkError({
      chunkCoord: { x: 0, z: 0 },
      reason: 'invalid block',
      localPosition: [5, 64, 7],
    })
    expect(err.message).toContain('5')
    expect(err.message).toContain('64')
    expect(err.message).toContain('7')
  })

  it('message does not include "at local" when localPosition is absent', () => {
    const err = new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'test' })
    expect(err.message).not.toContain('at local')
  })

  it('message is a non-empty string', () => {
    const err = new ChunkError({ chunkCoord: { x: 1, z: 2 }, reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('SettingsError', () => {
  it('has _tag === "SettingsError"', () => {
    const err = new SettingsError({ operation: 'load' })
    expect(err._tag).toBe('SettingsError')
  })

  it('message includes operation name', () => {
    const err = new SettingsError({ operation: 'save' })
    expect(err.message).toContain('save')
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new SettingsError({ operation: 'load', cause: new Error('parse error') })
    expect(err.message).toContain('parse error')
  })

  it('message is a non-empty string', () => {
    const err = new SettingsError({ operation: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('StartupError', () => {
  it('has _tag === "StartupError"', () => {
    const err = new StartupError({ reason: 'WebGL not supported' })
    expect(err._tag).toBe('StartupError')
  })

  it('message includes reason', () => {
    const err = new StartupError({ reason: 'canvas element not found' })
    expect(err.message).toContain('canvas element not found')
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new StartupError({ reason: 'init failed', cause: new Error('no WebGL2') })
    expect(err.message).toContain('no WebGL2')
  })

  it('message is a non-empty string', () => {
    const err = new StartupError({ reason: 'test' })
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('CameraError', () => {
  it('has _tag === "CameraError"', () => {
    const err = new CameraError({})
    expect(err._tag).toBe('CameraError')
  })

  it('message is a non-empty string', () => {
    const err = new CameraError({})
    expect(typeof err.message).toBe('string')
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('message includes cause message when cause is an Error', () => {
    const err = new CameraError({ cause: new Error('perspective matrix invalid') })
    expect(err.message).toContain('perspective matrix invalid')
  })

  it('message starts with "Camera creation failed"', () => {
    const err = new CameraError({})
    expect(err.message).toMatch(/^Camera creation failed/)
  })
})

describe('_tag uniqueness across domain errors', () => {
  const allErrors = [
    new TextureError({ url: 'test.png' }),
    new BlockError({ blockType: 'STONE', reason: 'test' }),
    new MeshError({ reason: 'test' }),
    new PlayerError({ playerId: 'p1', reason: 'test' }),
    new WorldError({ worldId: 'w1', reason: 'test' }),
    new GameLoopError({ reason: 'test' }),
    new StorageError({ operation: 'test' }),
    new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'test' }),
    new SettingsError({ operation: 'test' }),
    new StartupError({ reason: 'test' }),
    new CameraError({}),
  ]

  it('all domain error _tag values are defined', () => {
    for (const err of allErrors) {
      expect(typeof err._tag).toBe('string')
      expect(err._tag.length).toBeGreaterThan(0)
    }
  })

  it('domain error _tag values are unique among themselves', () => {
    const tags = Arr.map(allErrors, (e) => e._tag)
    const uniqueTags = HashSet.fromIterable(tags)
    // All 11 domain errors have unique tags among each other
    expect(HashSet.size(uniqueTags)).toBe(allErrors.length)
  })
})

describe('Effect.catchTag compatibility', () => {
  effectIt.effect('should catch TextureError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new TextureError({ url: 'test.png' })).pipe(
          Effect.catchTag('TextureError', (e) => Effect.succeed(`caught: ${e.url}`))
        )
      )
      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right).toBe('caught: test.png')
      }
    })
  )

  effectIt.effect('should catch BlockError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new BlockError({ blockType: 'STONE', reason: 'invalid' })).pipe(
        Effect.catchTag('BlockError', (e) => Effect.succeed(`caught: ${e.blockType}`))
      )
      expect(result).toBe('caught: STONE')
    })
  )

  effectIt.effect('should catch MeshError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new MeshError({ reason: 'vertex overflow' })).pipe(
        Effect.catchTag('MeshError', (e) => Effect.succeed(`caught: ${e.reason}`))
      )
      expect(result).toBe('caught: vertex overflow')
    })
  )

  effectIt.effect('should catch PlayerError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new PlayerError({ playerId: 'p1', reason: 'not found' })).pipe(
        Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
      )
      expect(result).toBe('caught: p1')
    })
  )

  effectIt.effect('should catch WorldError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new WorldError({ worldId: 'w1', reason: 'corrupt' })).pipe(
        Effect.catchTag('WorldError', (e) => Effect.succeed(`caught: ${e.worldId}`))
      )
      expect(result).toBe('caught: w1')
    })
  )

  effectIt.effect('should catch GameLoopError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new GameLoopError({ reason: 'frame drop' })).pipe(
        Effect.catchTag('GameLoopError', (e) => Effect.succeed(`caught: ${e.reason}`))
      )
      expect(result).toBe('caught: frame drop')
    })
  )

  effectIt.effect('should catch StorageError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new StorageError({ operation: 'saveChunk' })).pipe(
        Effect.catchTag('StorageError', (e) => Effect.succeed(`caught: ${e.operation}`))
      )
      expect(result).toBe('caught: saveChunk')
    })
  )

  effectIt.effect('should catch ChunkError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new ChunkError({ chunkCoord: { x: 3, z: -5 }, reason: 'not loaded' })).pipe(
        Effect.catchTag('ChunkError', (e) => Effect.succeed(`caught: ${e.chunkCoord.x},${e.chunkCoord.z}`))
      )
      expect(result).toBe('caught: 3,-5')
    })
  )

  effectIt.effect('should catch SettingsError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new SettingsError({ operation: 'save' })).pipe(
        Effect.catchTag('SettingsError', (e) => Effect.succeed(`caught: ${e.operation}`))
      )
      expect(result).toBe('caught: save')
    })
  )

  effectIt.effect('should catch StartupError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new StartupError({ reason: 'WebGL not supported' })).pipe(
        Effect.catchTag('StartupError', (e) => Effect.succeed(`caught: ${e.reason}`))
      )
      expect(result).toBe('caught: WebGL not supported')
    })
  )

  effectIt.effect('should catch CameraError with catchTag', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(new CameraError({ cause: new Error('invalid') })).pipe(
        Effect.catchTag('CameraError', () => Effect.succeed('caught camera error'))
      )
      expect(result).toBe('caught camera error')
    })
  )

  effectIt.effect('should NOT catch wrong error tag (TextureError caught by BlockError handler)', () =>
    Effect.gen(function* () {
      // Create an Effect with union error type (TextureError | BlockError) so catchTag('BlockError') is valid
      const eff = Effect.fail(new TextureError({ url: 'test.png' })) as Effect.Effect<never, TextureError | BlockError>
      const result = yield* Effect.either(
        eff.pipe(
          Effect.catchTag('BlockError', () => Effect.succeed('should not reach'))
        )
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('TextureError')
      }
    })
  )
})

describe('Data.TaggedError structural equality', () => {
  it('TextureError with same fields should be structurally equal', () => {
    const a = new TextureError({ url: 'test.png' })
    const b = new TextureError({ url: 'test.png' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('TextureError with different fields should not be structurally equal', () => {
    const a = new TextureError({ url: 'a.png' })
    const b = new TextureError({ url: 'b.png' })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it('BlockError with same fields should have identical properties', () => {
    const a = new BlockError({ blockType: 'STONE', reason: 'invalid', position: [1, 2, 3] })
    const b = new BlockError({ blockType: 'STONE', reason: 'invalid', position: [1, 2, 3] })
    expect(a._tag).toBe(b._tag)
    expect(a.blockType).toBe(b.blockType)
    expect(a.reason).toBe(b.reason)
    expect(a.position).toEqual(b.position)
    expect(a.message).toBe(b.message)
  })

  it('BlockError with different reason should not be structurally equal', () => {
    const a = new BlockError({ blockType: 'STONE', reason: 'invalid' })
    const b = new BlockError({ blockType: 'STONE', reason: 'out of bounds' })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it('PlayerError with same fields should be structurally equal', () => {
    const a = new PlayerError({ playerId: 'p1', reason: 'not found' })
    const b = new PlayerError({ playerId: 'p1', reason: 'not found' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('WorldError with same fields should have identical properties', () => {
    const a = new WorldError({ worldId: 'w1', reason: 'corrupt', position: [1, 2, 3] })
    const b = new WorldError({ worldId: 'w1', reason: 'corrupt', position: [1, 2, 3] })
    expect(a._tag).toBe(b._tag)
    expect(a.worldId).toBe(b.worldId)
    expect(a.reason).toBe(b.reason)
    expect(a.position).toEqual(b.position)
    expect(a.message).toBe(b.message)
  })

  it('GameLoopError with same fields should be structurally equal', () => {
    const a = new GameLoopError({ reason: 'frame drop' })
    const b = new GameLoopError({ reason: 'frame drop' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('StorageError with same fields should be structurally equal', () => {
    const a = new StorageError({ operation: 'save' })
    const b = new StorageError({ operation: 'save' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('ChunkError with same fields should have identical properties', () => {
    const a = new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'test' })
    const b = new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'test' })
    expect(a._tag).toBe(b._tag)
    expect(a.chunkCoord).toEqual(b.chunkCoord)
    expect(a.reason).toBe(b.reason)
    expect(a.message).toBe(b.message)
  })

  it('SettingsError with same fields should be structurally equal', () => {
    const a = new SettingsError({ operation: 'load' })
    const b = new SettingsError({ operation: 'load' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('StartupError with same fields should be structurally equal', () => {
    const a = new StartupError({ reason: 'test' })
    const b = new StartupError({ reason: 'test' })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('CameraError with no cause should be structurally equal', () => {
    const a = new CameraError({})
    const b = new CameraError({})
    expect(Equal.equals(a, b)).toBe(true)
  })

  it('different error types with same _tag-irrelevant fields are NOT equal', () => {
    const a = new PlayerError({ playerId: 'test', reason: 'test' })
    const b = new WorldError({ worldId: 'test', reason: 'test' })
    expect(Equal.equals(a, b)).toBe(false)
  })
})

describe('error _tag discrimination', () => {
  it('TextureError._tag is "TextureError"', () => {
    expect(new TextureError({ url: '' })._tag).toBe('TextureError')
  })

  it('BlockError._tag is "BlockError"', () => {
    expect(new BlockError({ blockType: 'AIR', reason: '' })._tag).toBe('BlockError')
  })

  it('MeshError._tag is "MeshError"', () => {
    expect(new MeshError({ reason: '' })._tag).toBe('MeshError')
  })

  it('PlayerError._tag is "PlayerError"', () => {
    expect(new PlayerError({ playerId: '', reason: '' })._tag).toBe('PlayerError')
  })

  it('WorldError._tag is "WorldError"', () => {
    expect(new WorldError({ worldId: '', reason: '' })._tag).toBe('WorldError')
  })

  it('GameLoopError._tag is "GameLoopError"', () => {
    expect(new GameLoopError({ reason: '' })._tag).toBe('GameLoopError')
  })

  it('StorageError._tag is "StorageError"', () => {
    expect(new StorageError({ operation: '' })._tag).toBe('StorageError')
  })

  it('ChunkError._tag is "ChunkError"', () => {
    expect(new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: '' })._tag).toBe('ChunkError')
  })

  it('SettingsError._tag is "SettingsError"', () => {
    expect(new SettingsError({ operation: '' })._tag).toBe('SettingsError')
  })

  it('StartupError._tag is "StartupError"', () => {
    expect(new StartupError({ reason: '' })._tag).toBe('StartupError')
  })

  it('CameraError._tag is "CameraError"', () => {
    expect(new CameraError({})._tag).toBe('CameraError')
  })
})

describe('SettingsError message format', () => {
  it('message matches format: "Settings <operation> failed" when no cause', () => {
    const err = new SettingsError({ operation: 'load' })
    expect(err.message).toBe('Settings load failed')
  })

  it('message includes cause string when cause is a plain string', () => {
    const err = new SettingsError({ operation: 'save', cause: 'permission denied' })
    expect(err.message).toContain('permission denied')
  })
})

describe('StartupError message format', () => {
  it('message includes reason directly when no cause', () => {
    const err = new StartupError({ reason: 'WebGL not supported' })
    expect(err.message).toBe('WebGL not supported')
  })

  it('message includes cause when cause is a string', () => {
    const err = new StartupError({ reason: 'init failed', cause: 'timeout' })
    expect(err.message).toContain('timeout')
  })
})

describe('CameraError message format', () => {
  it('message without cause is "Camera creation failed"', () => {
    const err = new CameraError({})
    expect(err.message).toBe('Camera creation failed')
  })

  it('message includes cause string', () => {
    const err = new CameraError({ cause: 'invalid FOV' })
    expect(err.message).toContain('invalid FOV')
  })
})

describe('Effect.either pattern with domain errors', () => {
  effectIt.effect('should produce Left with correct _tag for TextureError', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new TextureError({ url: 'missing.png' }))
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('TextureError')
        expect(result.left.url).toBe('missing.png')
      }
    })
  )

  effectIt.effect('should produce Left with correct _tag for ChunkError', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new ChunkError({ chunkCoord: { x: 5, z: -3 }, reason: 'chunk corrupt', localPosition: [1, 2, 3] }))
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ChunkError')
        expect(result.left.chunkCoord).toEqual({ x: 5, z: -3 })
        expect(result.left.localPosition).toEqual([1, 2, 3])
      }
    })
  )

  effectIt.effect('should produce Left with correct _tag for SettingsError', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new SettingsError({ operation: 'load', cause: new Error('parse') }))
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError')
        expect(result.left.operation).toBe('load')
      }
    })
  )

  effectIt.effect('should produce Left with correct _tag for StartupError', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new StartupError({ reason: 'no canvas' }))
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('StartupError')
        expect(result.left.reason).toBe('no canvas')
      }
    })
  )

  effectIt.effect('should produce Left with correct _tag for CameraError', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.fail(new CameraError({}))
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('CameraError')
      }
    })
  )
})
