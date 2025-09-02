import { fc, test } from '@fast-check/vitest'
import { Schema as S } from 'effect'
import { describe, expect } from 'vitest'
import * as T from '../types'
import { blockTypeNames } from '../block'
import { Position } from '../components'

// Arbitraries for base types

const positionArbitrary = fc.record({
  x: fc.float({ noNaN: true }),
  y: fc.float({ noNaN: true }),
  z: fc.float({ noNaN: true }),
})

const blockTypeArbitrary = fc.constantFrom(...blockTypeNames)

const placedBlockArbitrary = fc.record({
  position: fc.record({
    x: fc.integer(),
    y: fc.integer(),
    z: fc.integer(),
  }),
  blockType: blockTypeArbitrary,
})

const chunkMeshArbitrary = fc.record({
  positions: fc.float32Array({ minLength: 3, maxLength: 300 }),
  normals: fc.float32Array({ minLength: 3, maxLength: 300 }),
  uvs: fc.float32Array({ minLength: 2, maxLength: 200 }),
  indices: fc.uint32Array({ minLength: 3, maxLength: 300 }),
})

// Arbitraries for schemas in types.ts

const generationParamsArbitrary = fc.record({
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
  seeds: fc.record({
    world: fc.integer(),
    biome: fc.integer(),
    trees: fc.integer(),
  }),
  amplitude: fc.float({ noNaN: true }),
  editedBlocks: fc.record({
    placed: fc.dictionary(
      fc.string().filter((s) => s !== '__proto__'),
      fc.record({
        position: positionArbitrary.map((p) => new Position(p)),
        blockType: blockTypeArbitrary,
      }),
    ),
    destroyed: fc.array(fc.string()).map((arr) => new Set(arr)),
  }),
})

const chunkGenerationResultArbitrary = fc.record({
  blocks: fc.array(placedBlockArbitrary),
  mesh: chunkMeshArbitrary,
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
})

const computationTaskArbitrary = fc.record({
  type: fc.constant('generateChunk' as const),
  payload: generationParamsArbitrary,
})

const upsertChunkRenderCommandArbitrary = fc.record({
  type: fc.constant('UpsertChunk' as const),
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
  mesh: chunkMeshArbitrary,
})

const removeChunkRenderCommandArbitrary = fc.record({
  type: fc.constant('RemoveChunk' as const),
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
})

const browserInputStateArbitrary = fc.record({
  keyboard: fc.array(fc.string()).map((arr) => new Set(arr)),
  mouse: fc.record({
    dx: fc.float({ noNaN: true }),
    dy: fc.float({ noNaN: true }),
  }),
  isLocked: fc.boolean(),
})

const systemCommandArbitrary = fc.record({
  type: fc.constant('GenerateChunk' as const),
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
})

const schemas = {
  GenerationParamsSchema: { schema: T.GenerationParamsSchema, arbitrary: generationParamsArbitrary },
  ChunkGenerationResultSchema: { schema: T.ChunkGenerationResultSchema, arbitrary: chunkGenerationResultArbitrary },
  ComputationTaskSchema: { schema: T.ComputationTaskSchema, arbitrary: computationTaskArbitrary },
  UpsertChunkRenderCommandSchema: { schema: T.UpsertChunkRenderCommandSchema, arbitrary: upsertChunkRenderCommandArbitrary },
  RemoveChunkRenderCommandSchema: { schema: T.RemoveChunkRenderCommandSchema, arbitrary: removeChunkRenderCommandArbitrary },
  BrowserInputStateSchema: { schema: T.BrowserInputStateSchema, arbitrary: browserInputStateArbitrary },
  SystemCommandSchema: { schema: T.SystemCommandSchema, arbitrary: systemCommandArbitrary },
}

describe('Type Schemas', () => {
  for (const [name, { schema, arbitrary }] of Object.entries(schemas)) {
    test.prop([arbitrary])(`${name} should be reversible after encoding and decoding`, (value) => {
      const encode = S.encodeSync(schema as S.Schema<any, any, never>)
      const decode = S.decodeSync(schema as S.Schema<any, any, never>)
      // We need to manually check equality for Sets
      if ('editedBlocks' in value && value.editedBlocks.destroyed instanceof Set) {
        const original = value as T.GenerationParams
        const decodedValue = decode(encode(value)) as T.GenerationParams
        expect(Array.from(decodedValue.editedBlocks.destroyed)).toEqual(Array.from(original.editedBlocks.destroyed))
        // check the rest of the object
        const { destroyed: _, ...restOriginal } = original.editedBlocks
        const { destroyed: __, ...restDecoded } = decodedValue.editedBlocks
        expect({ ...decodedValue, editedBlocks: restDecoded }).toEqual({ ...original, editedBlocks: restOriginal })
      } else if ('keyboard' in value && value.keyboard instanceof Set) {
        const original = value as T.BrowserInputState
        const decodedValue = decode(encode(value)) as T.BrowserInputState
        expect(Array.from(decodedValue.keyboard)).toEqual(Array.from(original.keyboard))
        const { keyboard: _, ...restOriginal } = original
        const { keyboard: __, ...restDecoded } = decodedValue
        expect(restDecoded).toEqual(restOriginal)
      } else {
        expect(decode(encode(value))).toEqual(value)
      }
    })
  }
})
