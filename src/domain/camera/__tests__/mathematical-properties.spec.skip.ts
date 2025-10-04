/**
 * Camera Domain - 数学的性質Property-based Testing
 *
 * 座標変換・回転行列・距離計算の数学的性質を
 * Property-based Testingで厳密に検証
 */

import { it } from '@effect/vitest'
import { Brand, Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import * as THREE from 'three'
import {
  angleArbitrary,
  approximatelyEqual,
  cameraRotationArbitrary,
  direction3DArbitrary,
  edgeCasePositionArbitrary,
  effectProperty,
  EPSILON,
  largeBatchPositionArbitrary,
  pitchArbitrary,
  position3DApproximatelyEqual,
  position3DArbitrary,
  yawArbitrary,
} from './generators/effect-fastcheck-integration'

// Type definitions
type Position3D = { x: number; y: number; z: number } & Brand.Brand<'Position3D'>
type CameraRotation = { pitch: number; yaw: number; roll: number } & Brand.Brand<'CameraRotation'>
type Direction3D = { x: number; y: number; z: number } & Brand.Brand<'Direction3D'>
type Pitch = number & Brand.Brand<'Pitch'>
type Yaw = number & Brand.Brand<'Yaw'>
type Angle = number & Brand.Brand<'Angle'>

// ================================================================================
// 数学的操作関数（テスト対象）
// ================================================================================

/**
 * 座標変換関数
 */
const transformPosition = (position: Position3D, rotation: CameraRotation): Effect.Effect<Position3D, never> =>
  Effect.gen(function* () {
    const matrix = new THREE.Matrix4()
    matrix.makeRotationFromEuler(
      new THREE.Euler((rotation.pitch * Math.PI) / 180, (rotation.yaw * Math.PI) / 180, (rotation.roll * Math.PI) / 180)
    )

    const vector = new THREE.Vector3(position.x, position.y, position.z)
    vector.applyMatrix4(matrix)

    return Brand.nominal<Position3D>()({
      x: vector.x,
      y: vector.y,
      z: vector.z,
    })
  })

/**
 * 逆座標変換関数
 */
const reverseTransformation = (position: Position3D, rotation: CameraRotation): Effect.Effect<Position3D, never> =>
  Effect.gen(function* () {
    const matrix = new THREE.Matrix4()
    matrix.makeRotationFromEuler(
      new THREE.Euler((rotation.pitch * Math.PI) / 180, (rotation.yaw * Math.PI) / 180, (rotation.roll * Math.PI) / 180)
    )

    // 逆行列を適用
    const inverseMatrix = matrix.clone().invert()
    const vector = new THREE.Vector3(position.x, position.y, position.z)
    vector.applyMatrix4(inverseMatrix)

    return Brand.nominal<Position3D>()({
      x: vector.x,
      y: vector.y,
      z: vector.z,
    })
  })

/**
 * 回転行列生成
 */
const createRotationMatrix = (pitch: Pitch, yaw: Yaw): Effect.Effect<THREE.Matrix4, never> =>
  Effect.gen(function* () {
    const matrix = new THREE.Matrix4()
    matrix.makeRotationFromEuler(new THREE.Euler((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0))
    return matrix
  })

/**
 * 行列式計算
 */
const calculateDeterminant = (matrix: THREE.Matrix4): Effect.Effect<number, never> =>
  Effect.sync(() => matrix.determinant())

/**
 * 距離計算
 */
const calculateDistance = (pos1: Position3D, pos2: Position3D): Effect.Effect<number, never> =>
  Effect.sync(() => {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  })

/**
 * ベクトル正規化
 */
const normalizeVector = (position: Position3D): Effect.Effect<Direction3D, never> =>
  Effect.gen(function* () {
    const magnitude = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)

    if (magnitude < EPSILON) {
      // ゼロベクトルの場合は単位ベクトルを返す
      return Brand.nominal<Direction3D>()({ x: 1, y: 0, z: 0 })
    }

    return Brand.nominal<Direction3D>()({
      x: position.x / magnitude,
      y: position.y / magnitude,
      z: position.z / magnitude,
    })
  })

/**
 * 内積計算
 */
const dotProduct = (dir1: Direction3D, dir2: Direction3D): Effect.Effect<number, never> =>
  Effect.sync(() => dir1.x * dir2.x + dir1.y * dir2.y + dir1.z * dir2.z)

/**
 * 外積計算
 */
const crossProduct = (dir1: Direction3D, dir2: Direction3D): Effect.Effect<Direction3D, never> =>
  Effect.sync(() =>
    Brand.nominal<Direction3D>()({
      x: dir1.y * dir2.z - dir1.z * dir2.y,
      y: dir1.z * dir2.x - dir1.x * dir2.z,
      z: dir1.x * dir2.y - dir1.y * dir2.x,
    })
  )

// ================================================================================
// 数学的性質のProperty-based Testing
// ================================================================================

describe('Camera Domain - Mathematical Properties', () => {
  describe('座標変換の数学的性質', () => {
    it.effect('座標変換の可逆性（恒等変換）', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(position3DArbitrary, cameraRotationArbitrary), ([position, rotation]) =>
              Effect.gen(function* () {
                // 変換 → 逆変換で元の値に戻る
                const transformed = yield* transformPosition(position, rotation)
                const reversed = yield* reverseTransformation(transformed, rotation)

                // 浮動小数点誤差を考慮した等価性検証
                const isEqual = position3DApproximatelyEqual(position, reversed)
                return isEqual
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )

    it.effect('座標変換の線形性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(
              fc.tuple(position3DArbitrary, position3DArbitrary, cameraRotationArbitrary),
              ([pos1, pos2, rotation]) =>
                Effect.gen(function* () {
                  // T(a + b) = T(a) + T(b) （加法性）
                  const sumPosition = Brand.nominal<Position3D>()({
                    x: pos1.x + pos2.x,
                    y: pos1.y + pos2.y,
                    z: pos1.z + pos2.z,
                  })

                  const transformedSum = yield* transformPosition(sumPosition, rotation)
                  const transformed1 = yield* transformPosition(pos1, rotation)
                  const transformed2 = yield* transformPosition(pos2, rotation)

                  const manualSum = Brand.nominal<Position3D>()({
                    x: transformed1.x + transformed2.x,
                    y: transformed1.y + transformed2.y,
                    z: transformed1.z + transformed2.z,
                  })

                  return position3DApproximatelyEqual(transformedSum, manualSum)
                })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('座標変換の合成性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(
              fc.tuple(position3DArbitrary, cameraRotationArbitrary, cameraRotationArbitrary),
              ([position, rotation1, rotation2]) =>
                Effect.gen(function* () {
                  // T2(T1(p)) と T(T1+T2)(p) が等価
                  const step1 = yield* transformPosition(position, rotation1)
                  const step2 = yield* transformPosition(step1, rotation2)

                  // 回転の合成 - 正しい行列合成を使用
                  const matrix1 = new THREE.Matrix4()
                  matrix1.makeRotationFromEuler(
                    new THREE.Euler(
                      (rotation1.pitch * Math.PI) / 180,
                      (rotation1.yaw * Math.PI) / 180,
                      (rotation1.roll * Math.PI) / 180
                    )
                  )

                  const matrix2 = new THREE.Matrix4()
                  matrix2.makeRotationFromEuler(
                    new THREE.Euler(
                      (rotation2.pitch * Math.PI) / 180,
                      (rotation2.yaw * Math.PI) / 180,
                      (rotation2.roll * Math.PI) / 180
                    )
                  )

                  const combinedMatrix = new THREE.Matrix4().multiplyMatrices(matrix2, matrix1)
                  const vector = new THREE.Vector3(position.x, position.y, position.z)
                  vector.applyMatrix4(combinedMatrix)

                  const directTransform = Brand.nominal<Position3D>()({
                    x: vector.x,
                    y: vector.y,
                    z: vector.z,
                  })

                  return position3DApproximatelyEqual(step2, directTransform, 1e-3) // More tolerant for rotation composition
                })
            ),
            { numRuns: 300 }
          )
        )
      })
    )
  })

  describe('回転行列の数学的性質', () => {
    it.effect('回転行列の直交性（行列式 = ±1）', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(pitchArbitrary, yawArbitrary), ([pitch, yaw]) =>
              Effect.gen(function* () {
                const matrix = yield* createRotationMatrix(pitch, yaw)
                const determinant = yield* calculateDeterminant(matrix)

                // 直交行列の行列式は±1
                return approximatelyEqual(Math.abs(determinant), 1.0, 1e-10)
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )

    it.effect('回転行列の逆行列 = 転置行列', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(pitchArbitrary, yawArbitrary), ([pitch, yaw]) =>
              Effect.gen(function* () {
                const matrix = yield* createRotationMatrix(pitch, yaw)
                const inverse = matrix.clone().invert()
                const transpose = matrix.clone().transpose()

                // 回転行列では逆行列 = 転置行列
                let isEqual = true
                for (let i = 0; i < 16; i++) {
                  if (!approximatelyEqual(inverse.elements[i], transpose.elements[i], 1e-10)) {
                    isEqual = false
                    break
                  }
                }
                return isEqual
              })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('回転行列のべき等性（単位行列との関係）', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(angleArbitrary, (angle) =>
              Effect.gen(function* () {
                // 360度回転は単位変換
                const fullRotationPitch = Brand.nominal<Pitch>()(0)
                const fullRotationYaw = Brand.nominal<Yaw>()(360)

                const matrix = yield* createRotationMatrix(fullRotationPitch, fullRotationYaw)
                const identity = new THREE.Matrix4()

                // 360度回転は単位行列（誤差許容）
                let isIdentity = true
                for (let i = 0; i < 16; i++) {
                  if (!approximatelyEqual(matrix.elements[i], identity.elements[i], 1e-6)) {
                    isIdentity = false
                    break
                  }
                }
                return isIdentity
              })
            ),
            { numRuns: 200 }
          )
        )
      })
    )
  })

  describe('距離計算の数学的性質', () => {
    it.effect('距離計算の交換法則', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(position3DArbitrary, position3DArbitrary), ([pos1, pos2]) =>
              Effect.gen(function* () {
                const dist1 = yield* calculateDistance(pos1, pos2)
                const dist2 = yield* calculateDistance(pos2, pos1)

                // d(a,b) = d(b,a)
                return approximatelyEqual(dist1, dist2)
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )

    it.effect('距離計算の三角不等式', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(
              fc.tuple(position3DArbitrary, position3DArbitrary, position3DArbitrary),
              ([pos1, pos2, pos3]) =>
                Effect.gen(function* () {
                  const dist12 = yield* calculateDistance(pos1, pos2)
                  const dist23 = yield* calculateDistance(pos2, pos3)
                  const dist13 = yield* calculateDistance(pos1, pos3)

                  // d(a,c) ≤ d(a,b) + d(b,c)
                  return dist13 <= dist12 + dist23 + EPSILON
                })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('距離計算の自己同一性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(position3DArbitrary, (position) =>
              Effect.gen(function* () {
                const distance = yield* calculateDistance(position, position)

                // d(a,a) = 0
                return approximatelyEqual(distance, 0)
              })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('距離計算の非負性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(position3DArbitrary, position3DArbitrary), ([pos1, pos2]) =>
              Effect.gen(function* () {
                const distance = yield* calculateDistance(pos1, pos2)

                // d(a,b) ≥ 0
                return distance >= 0
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )
  })

  describe('ベクトル演算の数学的性質', () => {
    it.effect('正規化ベクトルの単位長', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(position3DArbitrary, (position) =>
              Effect.gen(function* () {
                const normalized = yield* normalizeVector(position)
                const magnitude = Math.sqrt(
                  normalized.x * normalized.x + normalized.y * normalized.y + normalized.z * normalized.z
                )

                // ||normalized|| = 1
                return approximatelyEqual(magnitude, 1.0)
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )

    it.effect('内積の交換法則', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(direction3DArbitrary, direction3DArbitrary), ([dir1, dir2]) =>
              Effect.gen(function* () {
                const dot1 = yield* dotProduct(dir1, dir2)
                const dot2 = yield* dotProduct(dir2, dir1)

                // a·b = b·a
                return approximatelyEqual(dot1, dot2)
              })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('内積の範囲（-1 ≤ a·b ≤ 1）', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(direction3DArbitrary, direction3DArbitrary), ([dir1, dir2]) =>
              Effect.gen(function* () {
                const dot = yield* dotProduct(dir1, dir2)

                // 単位ベクトル同士の内積は[-1, 1]の範囲
                return dot >= -1 - EPSILON && dot <= 1 + EPSILON
              })
            ),
            { numRuns: 1000 }
          )
        )
      })
    )

    it.effect('外積の反交換法則', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(direction3DArbitrary, direction3DArbitrary), ([dir1, dir2]) =>
              Effect.gen(function* () {
                const cross1 = yield* crossProduct(dir1, dir2)
                const cross2 = yield* crossProduct(dir2, dir1)

                // a×b = -(b×a)
                const isAntiCommutative =
                  approximatelyEqual(cross1.x, -cross2.x) &&
                  approximatelyEqual(cross1.y, -cross2.y) &&
                  approximatelyEqual(cross1.z, -cross2.z)

                return isAntiCommutative
              })
            ),
            { numRuns: 500 }
          )
        )
      })
    )

    it.effect('外積と内積の直交性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(fc.tuple(direction3DArbitrary, direction3DArbitrary), ([dir1, dir2]) =>
              Effect.gen(function* () {
                const cross = yield* crossProduct(dir1, dir2)
                const dot1 = yield* dotProduct(dir1, cross)
                const dot2 = yield* dotProduct(dir2, cross)

                // (a×b)·a = 0 and (a×b)·b = 0
                return approximatelyEqual(dot1, 0) && approximatelyEqual(dot2, 0)
              })
            ),
            { numRuns: 500 }
          )
        )
      })
    )
  })

  describe('エッジケース・境界値の数学的性質', () => {
    it.effect('極座標変換のエッジケース', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(edgeCasePositionArbitrary, (position) =>
              Effect.gen(function* () {
                // ゼロ回転での変換は恒等変換
                const zeroRotation = Brand.nominal<CameraRotation>()({
                  pitch: Brand.nominal<Pitch>()(0),
                  yaw: Brand.nominal<Yaw>()(0),
                  roll: Brand.nominal<Angle>()(0),
                })

                const transformed = yield* transformPosition(position, zeroRotation)

                return position3DApproximatelyEqual(position, transformed)
              })
            ),
            { numRuns: 100 }
          )
        )
      })
    )

    it.effect('大量データでの数値安定性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          fc.assert(
            effectProperty(
              largeBatchPositionArbitrary.map((positions) => positions.slice(0, 100)),
              (positions) =>
                Effect.gen(function* () {
                  // 大量の座標に対する距離計算の安定性
                  let allValid = true

                  for (let i = 0; i < positions.length - 1; i++) {
                    const distance = yield* calculateDistance(positions[i], positions[i + 1])
                    if (!Number.isFinite(distance) || distance < 0) {
                      allValid = false
                      break
                    }
                  }

                  return allValid
                })
            ),
            { numRuns: 10 }
          )
        )
      })
    )
  })
})
