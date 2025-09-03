import { describe, it, assert } from '@effect/vitest'
import { BlockType, createPlacedBlock, getUvForFace, isBlockFluid, isBlockTransparent } from '../block'
import { Vector3Int } from '../common'
import { Effect } from 'effect'
import { FaceNameSchema } from '../block'
import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { blockTypeNames } from '../block-types'

const blockTypeArbitrary = S.Literal(...blockTypeNames).pipe(Arbitrary.make)
const faceNameArbitrary = Arbitrary.make(FaceNameSchema)

describe('block', () => {
  describe('createPlacedBlock', () => {
    it.effect('should create a PlacedBlock object', () =>
      Effect.gen(function* (_) {
        const position: Vector3Int = [1, 2, 3]
        const blockType: BlockType = 'grass'
        const placedBlock = yield* _(createPlacedBlock(position, blockType))
        assert.deepStrictEqual(placedBlock, { position, blockType })
      }))
  })

  describe('getUvForFace', () => {
    it.prop('should return UV coordinates for any block type and face name', [blockTypeArbitrary, faceNameArbitrary], (blockType, faceName) =>
      Effect.gen(function* (_) {
        const uv = yield* _(getUvForFace(blockType, faceName))
        assert.isTrue(Array.isArray(uv))
        assert.lengthOf(uv, 2)
        assert.isNumber(uv[0])
        assert.isNumber(uv[1])
      }))
  })

  describe('isBlockTransparent', () => {
    it.prop('should return a boolean for any block type', [blockTypeArbitrary], (blockType) =>
      Effect.gen(function* (_) {
        const isTransparent = yield* _(isBlockTransparent(blockType))
        assert.isBoolean(isTransparent)
      }))
  })

  describe('isBlockFluid', () => {
    it.prop('should return a boolean for any block type', [blockTypeArbitrary], (blockType) =>
      Effect.gen(function* (_) {
        const isFluid = yield* _(isBlockFluid(blockType))
        assert.isBoolean(isFluid)
      }))
  })
})
