/**
 * Camera Control Domain Service Live Implementation
 *
 * カメラ制御ドメインサービスの純粋なドメインロジック実装。
 * 数学的計算とビジネスルールに基づく処理のみを含み、
 * 外部依存は一切持たない純粋関数として実装されています。
 */

import { Effect, Layer, Match } from 'effect'
import type { CameraDistance, CameraError, CameraRotation, Position3D, Vector3D } from '../../value_object'
import {
  AngleConversion,
  CameraRotationOps,
  createDirection3D,
  createPosition3D,
  Position3DOps,
} from '../../value_object'
import type { BoundingBox, PositionConstraints, SphericalCoordinate, ViewBounds } from './index'
import { CameraControlService } from './index'
import { CollisionDetectionService } from '../collision_detection'

/**
 * カメラ制御サービスのLive実装
 * 純粋なドメインロジックのみを含む
 */
export const CameraControlServiceLive = Layer.succeed(
  CameraControlService,
  CameraControlService.of({
    /**
     * 一人称視点のカメラ位置計算
     * プレイヤー位置に目の高さオフセットを追加
     */
    calculateFirstPersonPosition: (playerPosition, playerHeight) =>
      Effect.gen(function* () {
        // プレイヤーの85%の高さを目の位置とする（Minecraftの標準）
        const eyeHeight = playerHeight * 0.85
        const eyeOffset = yield* createPosition3D(0, eyeHeight, 0)

        return yield* Position3DOps.add(playerPosition, eyeOffset)
      }),

    /**
     * 三人称視点のカメラ位置計算
     * 球面座標系を使用してターゲットからの相対位置を計算
     */
    calculateThirdPersonPosition: (targetPosition, rotation, distance) =>
      Effect.gen(function* () {
        // カメラ回転から球面座標を計算
        const spherical = yield* rotationToSpherical(rotation)

        // 球面座標を直交座標に変換
        const offset = yield* sphericalToCartesianImpl(spherical, distance)

        // ターゲット位置からオフセットを減算（カメラは後ろに配置）
        return yield* Position3DOps.subtract(targetPosition, offset)
      }),

    /**
     * 位置制約の適用
     * 世界境界と高度制限を適用
     */
    applyPositionConstraints: (position, constraints) =>
      Effect.gen(function* () {
        // 世界境界内に制限
        let constrainedPosition = yield* clampToBounds(position, constraints.worldBounds)

        // 高度制限を適用
        constrainedPosition = yield* clampHeight(constrainedPosition, constraints.minHeight, constraints.maxHeight)

        // 地形衝突検証（実装時は地形データが必要）
        if (constraints.terrainCollision) {
          constrainedPosition = yield* checkTerrainCollision(constrainedPosition, constraints)

          // 衝突解決後に境界・高さを再評価
          constrainedPosition = yield* clampToBounds(constrainedPosition, constraints.worldBounds)
          constrainedPosition = yield* clampHeight(constrainedPosition, constraints.minHeight, constraints.maxHeight)
        }

        return constrainedPosition
      }),

    /**
     * 位置スムージング
     * 線形補間によるスムースな位置移動
     */
    smoothPosition: (currentPosition, targetPosition, deltaTime, smoothingFactor) => {
      // スムージング係数を時間に基づいて調整
      const lerpFactor = Math.min(1.0, deltaTime * smoothingFactor)

      return Position3DOps.lerp(currentPosition, targetPosition, lerpFactor)
    },

    /**
     * Look Direction計算
     * 回転角度から正規化された方向ベクトルを計算
     */
    calculateLookDirection: (rotation) => {
      const pitch = CameraRotationOps.getPitch(rotation)
      const yaw = CameraRotationOps.getYaw(rotation)

      // 球面座標から直交座標への変換
      const pitchRad = AngleConversion.degreesToRadians(pitch)
      const yawRad = AngleConversion.degreesToRadians(yaw)

      const x = Math.cos(pitchRad) * Math.sin(yawRad)
      const y = -Math.sin(pitchRad)
      const z = Math.cos(pitchRad) * Math.cos(yawRad)

      return createDirection3D(x, y, z)
    },

    /**
     * 球面座標から直交座標への変換
     */
    sphericalToCartesian: sphericalToCartesianImpl,

    /**
     * Up Vector計算
     * ロール角を考慮したアップベクトル
     */
    calculateUpVector: (rotation) => {
      const roll = CameraRotationOps.getRoll(rotation)
      const rollRad = AngleConversion.degreesToRadians(roll)

      // 基本のアップベクトル(0, 1, 0)をロール角で回転
      const x = Math.sin(rollRad)
      const y = Math.cos(rollRad)
      const z = 0

      return createDirection3D(x, y, z)
    },

    /**
     * ビュー境界計算
     * 視錐台の境界を計算
     */
    calculateViewBounds: (position, rotation, fov, aspectRatio, distance) =>
      Effect.gen(function* () {
        const fovRad = AngleConversion.degreesToRadians(fov)
        const halfFov = fovRad / 2

        const height = Math.tan(halfFov) * distance
        const width = height * aspectRatio

        return {
          left: -width,
          right: width,
          top: height,
          bottom: -height,
          near: 0.1,
          far: distance,
        } as ViewBounds
      }),
  })
)

/**
 * Helper Functions
 */

/**
 * カメラ回転から球面座標への変換
 */
const rotationToSpherical = (rotation: CameraRotation): Effect.Effect<SphericalCoordinate, CameraError> =>
  Effect.gen(function* () {
    const pitch = CameraRotationOps.getPitch(rotation)
    const yaw = CameraRotationOps.getYaw(rotation)

    // 角度をラジアンに変換
    const pitchRad = AngleConversion.degreesToRadians(pitch)
    const yawRad = AngleConversion.degreesToRadians(yaw)

    return {
      radius: 1.0, // 単位球面
      theta: yawRad, // 方位角
      phi: pitchRad, // 仰角
    }
  })

/**
 * 球面座標から直交座標への変換実装
 */
const sphericalToCartesianImpl = (
  spherical: SphericalCoordinate,
  distance: CameraDistance
): Effect.Effect<Vector3D, CameraError> =>
  Effect.gen(function* () {
    const { theta, phi } = spherical
    const radius = distance // 距離を半径として使用

    const x = radius * Math.cos(phi) * Math.sin(theta)
    const y = radius * Math.sin(phi)
    const z = radius * Math.cos(phi) * Math.cos(theta)

    return yield* createDirection3D(x, y, z)
  })

/**
 * 境界ボックス内への制限
 */
const clampToBounds = (position: Position3D, bounds: BoundingBox): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const { x, y, z } = Position3DOps.getCoordinates(position)
    const minCoords = Position3DOps.getCoordinates(bounds.min)
    const maxCoords = Position3DOps.getCoordinates(bounds.max)

    const clampedX = Math.max(minCoords.x, Math.min(maxCoords.x, x))
    const clampedY = Math.max(minCoords.y, Math.min(maxCoords.y, y))
    const clampedZ = Math.max(minCoords.z, Math.min(maxCoords.z, z))

    return yield* createPosition3D(clampedX, clampedY, clampedZ)
  })

/**
 * 高度制限の適用
 */
const clampHeight = (
  position: Position3D,
  minHeight: number,
  maxHeight: number
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const { x, y, z } = Position3DOps.getCoordinates(position)
    const clampedY = Math.max(minHeight, Math.min(maxHeight, y))

    return yield* createPosition3D(x, clampedY, z)
  })

/**
 * 地形衝突チェック（スタブ実装）
 * 実際の実装では地形データが必要
 */
const checkTerrainCollision = (
  position: Position3D,
  constraints: PositionConstraints
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const worldCollisionData = constraints.worldCollisionData

    if (!worldCollisionData) {
      return position
    }

    const collisionDetection = yield* CollisionDetectionService
    const radius = constraints.collisionRadius ?? 0.6

    const collisionResult = yield* collisionDetection.checkCameraCollision(position, radius, worldCollisionData)

    return yield* Match.value(collisionResult).pipe(
      Match.when({ _tag: 'Collision' }, (collision) =>
        collisionDetection
          .findSafePosition(position, position, radius, worldCollisionData)
          .pipe(Effect.catchAll(() => Effect.succeed(collision.hitPosition)))
      ),
      Match.orElse(() => Effect.succeed(position))
    )
  })
