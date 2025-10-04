/**
 * Collision Detection Domain Service
 *
 * カメラ衝突検出に関する純粋なドメインロジックを提供するサービス。
 * 世界ジオメトリとの衝突検出、安全な位置の計算、
 * レイキャスト処理等の衝突検出ロジックを集約しています。
 */

import { Context, Data, Effect, Option } from 'effect'
import type { BoundingBox, CameraError, Position3D, Vector3D } from '../../value-object'

/**
 * 衝突検出ドメインサービスの型定義
 */
export interface CollisionDetectionService {
  /**
   * カメラ衝突検出
   * 指定された位置での衝突を検出
   */
  readonly checkCameraCollision: (
    position: Position3D,
    collisionRadius: number,
    worldData: WorldCollisionData
  ) => Effect.Effect<CollisionResult, CameraError>

  /**
   * 安全な位置の検索
   * 衝突を回避する最適な位置を計算
   */
  readonly findSafePosition: (
    desiredPosition: Position3D,
    currentPosition: Position3D,
    collisionRadius: number,
    worldData: WorldCollisionData
  ) => Effect.Effect<Position3D, CameraError>

  /**
   * レイキャスト実行
   * 光線と世界ジオメトリの交差判定
   */
  readonly performRaycast: (
    origin: Position3D,
    direction: Vector3D,
    maxDistance: number,
    worldData: WorldCollisionData
  ) => Effect.Effect<Option.Option<RaycastHit>, CameraError>

  /**
   * 衝突回避計算
   * 障害物を回避する新しい位置を計算
   */
  readonly calculateCollisionAvoidance: (
    currentPosition: Position3D,
    targetPosition: Position3D,
    obstacles: readonly CollisionObject[]
  ) => Effect.Effect<Position3D, CameraError>

  /**
   * 球体-ボックス衝突判定
   * 球形カメラ境界とボックス型障害物の衝突検出
   */
  readonly sphereBoxCollision: (
    sphereCenter: Position3D,
    sphereRadius: number,
    box: BoundingBox
  ) => Effect.Effect<boolean, CameraError>

  /**
   * 球体-球体衝突判定
   * 二つの球体間の衝突検出
   */
  readonly sphereSphereCollision: (
    center1: Position3D,
    radius1: number,
    center2: Position3D,
    radius2: number
  ) => Effect.Effect<boolean, CameraError>

  /**
   * 最近接点計算
   * 点と障害物の最近接点を計算
   */
  readonly findClosestPoint: (point: Position3D, obstacle: CollisionObject) => Effect.Effect<Position3D, CameraError>

  /**
   * 複数衝突検出
   * 複数の障害物との同時衝突検出
   */
  readonly checkMultipleCollisions: (
    position: Position3D,
    collisionRadius: number,
    obstacles: readonly CollisionObject[]
  ) => Effect.Effect<readonly CollisionResult[], CameraError>

  /**
   * 動的衝突予測
   * 移動経路上での衝突を事前予測
   */
  readonly predictCollisionAlongPath: (
    startPosition: Position3D,
    endPosition: Position3D,
    collisionRadius: number,
    worldData: WorldCollisionData
  ) => Effect.Effect<Option.Option<PathCollisionInfo>, CameraError>
}

/**
 * 衝突結果のADT（代数的データ型）
 */
export type CollisionResult = Data.TaggedEnum<{
  NoCollision: {}
  Collision: {
    readonly hitPosition: Position3D
    readonly hitNormal: Vector3D
    readonly penetrationDepth: number
    readonly collisionObject: CollisionObject
  }
}>

/**
 * レイキャスト衝突情報
 */
export interface RaycastHit {
  readonly position: Position3D
  readonly normal: Vector3D
  readonly distance: number
  readonly object: CollisionObject
  readonly textureCoordinate?: readonly [number, number]
}

/**
 * 衝突オブジェクト
 */
export type CollisionObject = Data.TaggedEnum<{
  Box: {
    readonly boundingBox: BoundingBox
    readonly material: CollisionMaterial
  }
  Sphere: {
    readonly center: Position3D
    readonly radius: number
    readonly material: CollisionMaterial
  }
  Plane: {
    readonly point: Position3D
    readonly normal: Vector3D
    readonly material: CollisionMaterial
  }
  Mesh: {
    readonly vertices: readonly Position3D[]
    readonly indices: readonly number[]
    readonly material: CollisionMaterial
  }
}>

/**
 * 衝突マテリアル
 */
export interface CollisionMaterial {
  readonly type: CollisionMaterialType
  readonly friction: number
  readonly bounciness: number
  readonly penetrable: boolean
  readonly density: number
}

/**
 * 衝突マテリアル種別
 */
export type CollisionMaterialType =
  | 'solid' // 固体（完全にブロック）
  | 'liquid' // 液体（通過可能だが抵抗あり）
  | 'gas' // 気体（ほぼ通過可能）
  | 'transparent' // 透明（視覚的にのみ存在）

/**
 * 世界衝突データ
 */
export interface WorldCollisionData {
  readonly staticObjects: readonly CollisionObject[]
  readonly dynamicObjects: readonly CollisionObject[]
  readonly terrain: TerrainCollisionData
  readonly worldBounds: BoundingBox
}

/**
 * 地形衝突データ
 */
export interface TerrainCollisionData {
  readonly heightMap: readonly (readonly number[])[]
  readonly blockData: readonly (readonly (readonly BlockType[])[])[]
  readonly chunkSize: number
  readonly blockSize: number
}

/**
 * ブロック種別
 */
export type BlockType = 'air' | 'solid' | 'liquid' | 'transparent'

/**
 * 経路衝突情報
 */
export interface PathCollisionInfo {
  readonly collisionPoint: Position3D
  readonly collisionNormal: Vector3D
  readonly collisionTime: number // 0.0-1.0, パス上での衝突時点
  readonly collisionObject: CollisionObject
  readonly safePosition: Position3D // 衝突前の安全な位置
}

/**
 * 衝突検出設定
 */
export interface CollisionDetectionSettings {
  readonly enableTerrainCollision: boolean
  readonly enableEntityCollision: boolean
  readonly enableStaticCollision: boolean
  readonly collisionMargin: number // 衝突判定のマージン
  readonly maxIterations: number // 位置調整の最大反復回数
  readonly convergenceThreshold: number // 収束判定の閾値
}

/**
 * Collision Detection Service Context Tag
 * Effect-TSのDIコンテナで使用するサービスタグ
 */
export const CollisionDetectionService = Context.GenericTag<CollisionDetectionService>(
  '@minecraft/domain/camera/CollisionDetectionService'
)

/**
 * Helper constructors for CollisionResult ADT
 */
export const CollisionResult = Data.taggedEnum<CollisionResult>()

/**
 * Helper constructors for CollisionObject ADT
 */
export const CollisionObject = Data.taggedEnum<CollisionObject>()
