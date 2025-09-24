import { describe, expect } from 'vitest'
import { Effect } from 'effect'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import {
  Vector3DSchema,
  Rotation3DSchema,
  DistanceSchema,
  AngleSchema,
  ChunkCoordinateSchema,
  BlockCoordinateSchema,
  SpatialBrands,
  type Vector3D,
  type Rotation3D,
  type Distance,
  type Angle,
  type ChunkCoordinate,
  type BlockCoordinate,
} from '../spatial-brands'

describe('Spatial Brand Types', () => {
  describe('Vector3DSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validVectors = [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 2, z: 3 },
          { x: -1.5, y: 0.5, z: -2.7 },
          { x: 1000000, y: -1000000, z: 0 },
        ]

        validVectors.forEach((vector) => {
          expect(() => Schema.decodeSync(Vector3DSchema)(vector)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidVectors = [
          { x: NaN, y: 0, z: 0 },
          { x: 0, y: Infinity, z: 0 },
          { x: 0, y: 0, z: -Infinity },
          { x: 'invalid' as any, y: 0, z: 0 },
        ]

        invalidVectors.forEach((vector) => {
          expect(() => Schema.decodeSync(Vector3DSchema)(vector)).toThrow()
        })
      })
    )
  })

  describe('Rotation3DSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validRotations = [
          { pitch: 0, yaw: 0, roll: 0 },
          { pitch: Math.PI / 2, yaw: Math.PI, roll: -Math.PI / 4 },
          { pitch: -Math.PI, yaw: Math.PI, roll: 0 },
        ]

        validRotations.forEach((rotation) => {
          expect(() => Schema.decodeSync(Rotation3DSchema)(rotation)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidRotations = [
          { pitch: Math.PI + 0.1, yaw: 0, roll: 0 }, // pitch > π
          { pitch: 0, yaw: -Math.PI - 0.1, roll: 0 }, // yaw < -π
          { pitch: 0, yaw: 0, roll: Math.PI + 0.1 }, // roll > π
          { pitch: NaN, yaw: 0, roll: 0 },
        ]

        invalidRotations.forEach((rotation) => {
          expect(() => Schema.decodeSync(Rotation3DSchema)(rotation)).toThrow()
        })
      })
    )
  })

  describe('DistanceSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validDistances = [0, 1, 5.5, 100, 1000000]

        validDistances.forEach((distance) => {
          expect(() => Schema.decodeSync(DistanceSchema)(distance)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidDistances = [-1, -0.1, NaN, Infinity, -Infinity]

        invalidDistances.forEach((distance) => {
          expect(() => Schema.decodeSync(DistanceSchema)(distance)).toThrow()
        })
      })
    )
  })

  describe('AngleSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validAngles = [0, Math.PI / 2, Math.PI, -Math.PI, Math.PI * 2, -Math.PI * 2]

        validAngles.forEach((angle) => {
          expect(() => Schema.decodeSync(AngleSchema)(angle)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidAngles = [Math.PI * 2.1, -Math.PI * 2.1, NaN, Infinity]

        invalidAngles.forEach((angle) => {
          expect(() => Schema.decodeSync(AngleSchema)(angle)).toThrow()
        })
      })
    )
  })

  describe('ChunkCoordinateSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validCoords = [0, -1, 5, -10, 1000, -1000]

        validCoords.forEach((coord) => {
          expect(() => Schema.decodeSync(ChunkCoordinateSchema)(coord)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidCoords = [1.5, -0.5, NaN, Infinity]

        invalidCoords.forEach((coord) => {
          expect(() => Schema.decodeSync(ChunkCoordinateSchema)(coord)).toThrow()
        })
      })
    )
  })

  describe('BlockCoordinateSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validCoords = [0, 16, -32, 256, 1000, -1000]

        validCoords.forEach((coord) => {
          expect(() => Schema.decodeSync(BlockCoordinateSchema)(coord)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidCoords = [1.5, -0.5, NaN, Infinity]

        invalidCoords.forEach((coord) => {
          expect(() => Schema.decodeSync(BlockCoordinateSchema)(coord)).toThrow()
        })
      })
    )
  })

  describe('SpatialBrands helpers', () => {
    describe('Vector3D helpers', () => {
      it.effect('createVector3D - 正常なベクトルを作成する', () =>
        Effect.gen(function* () {
          const vector = SpatialBrands.createVector3D(1, 2, 3)
          expect(vector).toEqual({ x: 1, y: 2, z: 3 })
        })
      )

      it.effect('zeroVector - ゼロベクトルを作成する', () =>
        Effect.gen(function* () {
          const vector = SpatialBrands.zeroVector()
          expect(vector).toEqual({ x: 0, y: 0, z: 0 })
        })
      )

      it.effect('unit vectors - 単位ベクトルを作成する', () =>
        Effect.gen(function* () {
          expect(SpatialBrands.unitX()).toEqual({ x: 1, y: 0, z: 0 })
          expect(SpatialBrands.unitY()).toEqual({ x: 0, y: 1, z: 0 })
          expect(SpatialBrands.unitZ()).toEqual({ x: 0, y: 0, z: 1 })
        })
      )
    })

    describe('Rotation3D helpers', () => {
      it.effect('createRotation3D - 正常な回転を作成する', () =>
        Effect.gen(function* () {
          const rotation = SpatialBrands.createRotation3D(Math.PI / 4, Math.PI / 2, 0)
          expect(rotation).toEqual({ pitch: Math.PI / 4, yaw: Math.PI / 2, roll: 0 })
        })
      )

      it.effect('identityRotation - 単位回転を作成する', () =>
        Effect.gen(function* () {
          const rotation = SpatialBrands.identityRotation()
          expect(rotation).toEqual({ pitch: 0, yaw: 0, roll: 0 })
        })
      )
    })

    describe('Distance helpers', () => {
      it.effect('createDistance - 正常な距離を作成する', () =>
        Effect.gen(function* () {
          const distance = SpatialBrands.createDistance(5.5)
          expect(distance).toBe(5.5)
        })
      )
    })

    describe('Angle helpers', () => {
      it.effect('createAngle - 正常な角度を作成する', () =>
        Effect.gen(function* () {
          const angle = SpatialBrands.createAngle(Math.PI / 2)
          expect(angle).toBe(Math.PI / 2)
        })
      )

      it.effect('angleFromDegrees - 度からラジアンに変換する', () =>
        Effect.gen(function* () {
          const angle = SpatialBrands.angleFromDegrees(90)
          expect(angle).toBeCloseTo(Math.PI / 2, 10)
        })
      )

      it.effect('angleFromDegrees - さまざまな度数の変換', () =>
        Effect.gen(function* () {
          expect(SpatialBrands.angleFromDegrees(0)).toBe(0)
          expect(SpatialBrands.angleFromDegrees(180)).toBeCloseTo(Math.PI, 10)
          expect(SpatialBrands.angleFromDegrees(360)).toBeCloseTo(Math.PI * 2, 10)
          expect(SpatialBrands.angleFromDegrees(-90)).toBeCloseTo(-Math.PI / 2, 10)
        })
      )
    })

    describe('Coordinate conversion helpers', () => {
      it.effect('worldToChunk - ワールド座標からチャンク座標に変換する', () =>
        Effect.gen(function* () {
          expect(SpatialBrands.worldToChunk(0)).toBe(0)
          expect(SpatialBrands.worldToChunk(15)).toBe(0)
          expect(SpatialBrands.worldToChunk(16)).toBe(1)
          expect(SpatialBrands.worldToChunk(-1)).toBe(-1)
          expect(SpatialBrands.worldToChunk(-16)).toBe(-1)
          expect(SpatialBrands.worldToChunk(-17)).toBe(-2)
        })
      )

      it.effect('chunkToWorld - チャンク座標からワールド座標に変換する', () =>
        Effect.gen(function* () {
          const chunkCoord0: ChunkCoordinate = SpatialBrands.createChunkCoordinate(0)
          const chunkCoord1: ChunkCoordinate = SpatialBrands.createChunkCoordinate(1)
          const chunkCoordNeg1: ChunkCoordinate = SpatialBrands.createChunkCoordinate(-1)

          expect(SpatialBrands.chunkToWorld(chunkCoord0)).toBe(0)
          expect(SpatialBrands.chunkToWorld(chunkCoord1)).toBe(16)
          expect(SpatialBrands.chunkToWorld(chunkCoordNeg1)).toBe(-16)
        })
      )
    })
  })

  describe('型の互換性テスト', () => {
    it.effect('異なるBrand型は互換性がない', () =>
      Effect.gen(function* () {
        const distance: Distance = SpatialBrands.createDistance(5)
        const angle: Angle = SpatialBrands.createAngle(5)

        // 両方とも数値だが、型として区別される
        expect(typeof distance).toBe('number')
        expect(typeof angle).toBe('number')
        expect(distance).toBe(angle) // 値は同じ
      })
    )

    it.effect('構造体Brand型の型安全性', () =>
      Effect.gen(function* () {
        const vector: Vector3D = SpatialBrands.createVector3D(1, 2, 3)
        const rotation: Rotation3D = SpatialBrands.createRotation3D(1, 2, 3)

        // 構造は似ているが、型として区別される
        expect(typeof vector).toBe('object')
        expect(typeof rotation).toBe('object')

        // プロパティ名は異なる
        expect('x' in vector).toBe(true)
        expect('pitch' in rotation).toBe(true)
        expect('pitch' in vector).toBe(false)
        expect('x' in rotation).toBe(false)
      })
    )
  })
})
