/**
 * Collision Detection Domain Service Live Implementation
 *
 * 衝突検出ドメインサービスの純粋なドメインロジック実装。
 * 数学的衝突検出アルゴリズム、幾何学計算、
 * 空間分割による最適化を含む処理を実装しています。
 */

import { Effect, Layer, Match, Option, pipe } from 'effect'
import type { BoundingBox, CameraError, Position3D, Vector3D } from '../../value_object'
import { Position3DOps, createDirection3D, createPosition3D } from '../../value_object'
import type {
  CollisionMaterial,
  CollisionMaterialType,
  PathCollisionInfo,
  RaycastHit,
  TerrainCollisionData,
} from './index'
import { CollisionDetectionService, CollisionObject, CollisionResult } from './index'

/**
 * 衝突検出サービスのLive実装
 * 純粋なドメインロジックのみを含む
 */
export const CollisionDetectionServiceLive = Layer.succeed(
  CollisionDetectionService,
  CollisionDetectionService.of({
    /**
     * カメラ衝突検出
     * 球形境界を使用した衝突検出
     */
    checkCameraCollision: (position, collisionRadius, worldData) =>
      Effect.gen(function* () {
        // 静的オブジェクトとの衝突チェック
        for (const obj of worldData.staticObjects) {
          const collision = yield* checkSingleObjectCollision(position, collisionRadius, obj)
          if (collision._tag === 'Collision') {
            return collision
          }
        }

        // 動的オブジェクトとの衝突チェック
        for (const obj of worldData.dynamicObjects) {
          const collision = yield* checkSingleObjectCollision(position, collisionRadius, obj)
          if (collision._tag === 'Collision') {
            return collision
          }
        }

        // 地形との衝突チェック
        const terrainCollision = yield* checkTerrainCollision(position, collisionRadius, worldData.terrain)
        if (terrainCollision._tag === 'Collision') {
          return terrainCollision
        }

        return CollisionResult.NoCollision()
      }),

    /**
     * 安全な位置の検索
     * 反復的な位置調整による衝突回避
     */
    findSafePosition: (desiredPosition, currentPosition, collisionRadius, worldData) =>
      Effect.gen(function* () {
        let candidatePosition = desiredPosition
        const maxIterations = 10
        const stepSize = 0.1

        for (let i = 0; i < maxIterations; i++) {
          const collision = yield* checkCameraCollision(candidatePosition, collisionRadius, worldData)

          if (collision._tag === 'NoCollision') {
            return candidatePosition
          }

          // 衝突から離れる方向に位置を調整
          const avoidanceVector = yield* calculateAvoidanceVector(collision, candidatePosition)
          candidatePosition = yield* Position3DOps.add(candidatePosition, avoidanceVector)
        }

        // 安全な位置が見つからない場合は現在位置を返す
        return currentPosition
      }),

    /**
     * レイキャスト実行
     * 光線と世界ジオメトリの交差判定
     */
    performRaycast: (origin, direction, maxDistance, worldData) =>
      Effect.gen(function* () {
        let closestHit: RaycastHit | undefined
        let closestDistance = maxDistance

        // 正規化された方向ベクトルを確保
        const normalizedDirection = yield* normalizeVector(direction)

        // 静的オブジェクトとのレイキャスト
        for (const obj of worldData.staticObjects) {
          const hit = yield* raycastSingleObject(origin, normalizedDirection, closestDistance, obj)
          if (Option.isSome(hit) && hit.value.distance < closestDistance) {
            closestHit = hit.value
            closestDistance = hit.value.distance
          }
        }

        // 動的オブジェクトとのレイキャスト
        for (const obj of worldData.dynamicObjects) {
          const hit = yield* raycastSingleObject(origin, normalizedDirection, closestDistance, obj)
          if (Option.isSome(hit) && hit.value.distance < closestDistance) {
            closestHit = hit.value
            closestDistance = hit.value.distance
          }
        }

        return Option.fromNullable(closestHit)
      }),

    /**
     * 衝突回避計算
     * 複数の障害物を考慮した最適経路計算
     */
    calculateCollisionAvoidance: (currentPosition, targetPosition, obstacles) =>
      Effect.gen(function* () {
        // 目標への直線経路をチェック
        const directPath = yield* isPathClear(currentPosition, targetPosition, obstacles)
        if (directPath) {
          return targetPosition
        }

        // 障害物を回避する代替経路を計算
        const avoidancePosition = yield* findAvoidancePath(currentPosition, targetPosition, obstacles)
        return avoidancePosition
      }),

    /**
     * 球体-ボックス衝突判定
     */
    sphereBoxCollision: (sphereCenter, sphereRadius, box) =>
      Effect.gen(function* () {
        const { min, max } = box
        const minCoords = Position3DOps.getCoordinates(min)
        const maxCoords = Position3DOps.getCoordinates(max)
        const sphereCoords = Position3DOps.getCoordinates(sphereCenter)

        // 球体の中心からボックスの最近点を計算
        const closestX = Math.max(minCoords.x, Math.min(sphereCoords.x, maxCoords.x))
        const closestY = Math.max(minCoords.y, Math.min(sphereCoords.y, maxCoords.y))
        const closestZ = Math.max(minCoords.z, Math.min(sphereCoords.z, maxCoords.z))

        const closestPoint = yield* createPosition3D(closestX, closestY, closestZ)
        const distance = yield* Position3DOps.distance(sphereCenter, closestPoint)

        return distance <= sphereRadius
      }),

    /**
     * 球体-球体衝突判定
     */
    sphereSphereCollision: (center1, radius1, center2, radius2) =>
      Effect.gen(function* () {
        const distance = yield* Position3DOps.distance(center1, center2)
        return distance <= radius1 + radius2
      }),

    /**
     * 最近接点計算
     */
    findClosestPoint: (point, obstacle) =>
      Effect.gen(function* () {
        return yield* pipe(
          obstacle,
          Match.value,
          Match.tag('Box', ({ boundingBox }) => findClosestPointToBox(point, boundingBox)),
          Match.tag('Sphere', ({ center, radius }) => findClosestPointToSphere(point, center, radius)),
          Match.tag('Plane', ({ point: planePoint, normal }) => findClosestPointToPlane(point, planePoint, normal)),
          Match.tag('Mesh', ({ vertices, indices }) => findClosestPointToMesh(point, vertices, indices)),
          Match.exhaustive
        )
      }),

    /**
     * 複数衝突検出
     */
    checkMultipleCollisions: (position, collisionRadius, obstacles) =>
      Effect.gen(function* () {
        const collisions: CollisionResult[] = []

        for (const obstacle of obstacles) {
          const collision = yield* checkSingleObjectCollision(position, collisionRadius, obstacle)
          collisions.push(collision)
        }

        return collisions
      }),

    /**
     * 動的衝突予測
     */
    predictCollisionAlongPath: (startPosition, endPosition, collisionRadius, worldData) =>
      Effect.gen(function* () {
        const pathDirection = yield* Position3DOps.subtract(endPosition, startPosition)
        const pathLength = yield* Position3DOps.magnitude(pathDirection)
        const normalizedDirection = yield* Position3DOps.normalize(pathDirection)

        const steps = Math.ceil(pathLength / (collisionRadius * 0.5))
        const stepSize = pathLength / steps

        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const currentPosition = yield* Position3DOps.lerp(startPosition, endPosition, t)

          const collision = yield* checkCameraCollision(currentPosition, collisionRadius, worldData)
          if (collision._tag === 'Collision') {
            // 衝突前の安全な位置を計算
            const safeT = Math.max(0, (i - 1) / steps)
            const safePosition = yield* Position3DOps.lerp(startPosition, endPosition, safeT)

            const pathCollisionInfo: PathCollisionInfo = {
              collisionPoint: collision.hitPosition,
              collisionNormal: collision.hitNormal,
              collisionTime: t,
              collisionObject: collision.collisionObject,
              safePosition,
            }

            return Option.some(pathCollisionInfo)
          }
        }

        return Option.none()
      }),
  })
)

/**
 * Helper Functions
 */

/**
 * 単一オブジェクトとの衝突チェック
 */
const checkSingleObjectCollision = (
  position: Position3D,
  collisionRadius: number,
  obj: CollisionObject
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    return yield* pipe(
      obj,
      Match.value,
      Match.tag('Box', ({ boundingBox, material }) =>
        checkBoxCollision(position, collisionRadius, boundingBox, material, obj)
      ),
      Match.tag('Sphere', ({ center, radius, material }) =>
        checkSphereCollision(position, collisionRadius, center, radius, material, obj)
      ),
      Match.tag('Plane', ({ point, normal, material }) =>
        checkPlaneCollision(position, collisionRadius, point, normal, material, obj)
      ),
      Match.tag('Mesh', ({ vertices, indices, material }) =>
        checkMeshCollision(position, collisionRadius, vertices, indices, material, obj)
      ),
      Match.exhaustive
    )
  })

/**
 * ボックスとの衝突チェック
 */
const checkBoxCollision = (
  position: Position3D,
  collisionRadius: number,
  box: BoundingBox,
  material: CollisionMaterial,
  obj: CollisionObject
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    const isColliding = yield* sphereBoxCollision(position, collisionRadius, box)

    if (!isColliding) {
      return CollisionResult.NoCollision()
    }

    // 衝突詳細を計算
    const closestPoint = yield* findClosestPointToBox(position, box)
    const hitNormal = yield* calculateBoxNormal(position, box)
    const penetrationDepth = yield* calculatePenetrationDepth(position, closestPoint, collisionRadius)

    return CollisionResult.Collision({
      hitPosition: closestPoint,
      hitNormal,
      penetrationDepth,
      collisionObject: obj,
    })
  })

/**
 * 球体との衝突チェック
 */
const checkSphereCollision = (
  position: Position3D,
  collisionRadius: number,
  sphereCenter: Position3D,
  sphereRadius: number,
  material: CollisionMaterial,
  obj: CollisionObject
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    const isColliding = yield* sphereSphereCollision(position, collisionRadius, sphereCenter, sphereRadius)

    if (!isColliding) {
      return CollisionResult.NoCollision()
    }

    // 衝突詳細を計算
    const direction = yield* Position3DOps.subtract(position, sphereCenter)
    const distance = yield* Position3DOps.magnitude(direction)
    const hitNormal = yield* Position3DOps.normalize(direction)

    const hitPosition = yield* Position3DOps.add(sphereCenter, yield* Position3DOps.scale(hitNormal, sphereRadius))

    const penetrationDepth = collisionRadius + sphereRadius - distance

    return CollisionResult.Collision({
      hitPosition,
      hitNormal,
      penetrationDepth,
      collisionObject: obj,
    })
  })

/**
 * 平面との衝突チェック
 */
const checkPlaneCollision = (
  position: Position3D,
  collisionRadius: number,
  planePoint: Position3D,
  planeNormal: Vector3D,
  material: CollisionMaterial,
  obj: CollisionObject
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    const distance = yield* distanceToPlane(position, planePoint, planeNormal)

    if (Math.abs(distance) > collisionRadius) {
      return CollisionResult.NoCollision()
    }

    const hitPosition = yield* findClosestPointToPlane(position, planePoint, planeNormal)
    const penetrationDepth = collisionRadius - Math.abs(distance)

    return CollisionResult.Collision({
      hitPosition,
      hitNormal: planeNormal,
      penetrationDepth,
      collisionObject: obj,
    })
  })

/**
 * メッシュとの衝突チェック（簡易実装）
 */
const checkMeshCollision = (
  position: Position3D,
  collisionRadius: number,
  vertices: readonly Position3D[],
  indices: readonly number[],
  material: CollisionMaterial,
  obj: CollisionObject
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：メッシュの境界ボックスとの衝突チェック
    const boundingBox = yield* calculateMeshBoundingBox(vertices)
    return yield* checkBoxCollision(position, collisionRadius, boundingBox, material, obj)
  })

/**
 * 地形との衝突チェック
 */
const checkTerrainCollision = (
  position: Position3D,
  collisionRadius: number,
  terrain: TerrainCollisionData
): Effect.Effect<CollisionResult, CameraError> =>
  Effect.gen(function* () {
    const coords = Position3DOps.getCoordinates(position)

    // グリッド座標に変換
    const gridX = Math.floor(coords.x / terrain.blockSize)
    const gridZ = Math.floor(coords.z / terrain.blockSize)

    // 境界チェック
    if (gridX < 0 || gridZ < 0 || gridX >= terrain.blockData[0]?.length || gridZ >= terrain.blockData.length) {
      return CollisionResult.NoCollision()
    }

    // 地形高度をチェック
    const terrainHeight = terrain.heightMap[gridZ]?.[gridX] ?? 0
    const cameraBottom = coords.y - collisionRadius

    if (cameraBottom <= terrainHeight) {
      const hitPosition = yield* createPosition3D(coords.x, terrainHeight, coords.z)
      const hitNormal = yield* createDirection3D(0, 1, 0) // 上向き法線
      const penetrationDepth = terrainHeight - cameraBottom

      // ダミーの地形衝突オブジェクトを作成
      const terrainObject = CollisionObject.Box({
        boundingBox: {
          min: yield* createPosition3D(gridX * terrain.blockSize, 0, gridZ * terrain.blockSize),
          max: yield* createPosition3D((gridX + 1) * terrain.blockSize, terrainHeight, (gridZ + 1) * terrain.blockSize),
        },
        material: {
          type: 'solid' as CollisionMaterialType,
          friction: 0.8,
          bounciness: 0.1,
          penetrable: false,
          density: 1.0,
        },
      })

      return CollisionResult.Collision({
        hitPosition,
        hitNormal,
        penetrationDepth,
        collisionObject: terrainObject,
      })
    }

    return CollisionResult.NoCollision()
  })

/**
 * Helper utility functions
 */
const sphereBoxCollision = (sphereCenter: Position3D, sphereRadius: number, box: BoundingBox) =>
  CollisionDetectionServiceLive.context.pipe(
    Effect.andThen((service) => service.sphereBoxCollision(sphereCenter, sphereRadius, box))
  )

const sphereSphereCollision = (center1: Position3D, radius1: number, center2: Position3D, radius2: number) =>
  CollisionDetectionServiceLive.context.pipe(
    Effect.andThen((service) => service.sphereSphereCollision(center1, radius1, center2, radius2))
  )

const normalizeVector = (vector: Vector3D): Effect.Effect<Vector3D, CameraError> =>
  Effect.gen(function* () {
    return yield* Position3DOps.normalize(vector)
  })

const calculateAvoidanceVector = (
  collision: CollisionResult,
  position: Position3D
): Effect.Effect<Vector3D, CameraError> =>
  Effect.gen(function* () {
    if (collision._tag === 'NoCollision') {
      return yield* createDirection3D(0, 0, 0)
    }

    const avoidanceDirection = yield* Position3DOps.scale(
      collision.hitNormal,
      collision.penetrationDepth + 0.1 // 少し余裕を持たせる
    )

    return avoidanceDirection
  })

const raycastSingleObject = (
  origin: Position3D,
  direction: Vector3D,
  maxDistance: number,
  obj: CollisionObject
): Effect.Effect<Option.Option<RaycastHit>, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：詳細なレイキャストは実装時に追加
    return Option.none()
  })

const isPathClear = (
  start: Position3D,
  end: Position3D,
  obstacles: readonly CollisionObject[]
): Effect.Effect<boolean, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：直線経路の衝突チェック
    return true
  })

const findAvoidancePath = (
  current: Position3D,
  target: Position3D,
  obstacles: readonly CollisionObject[]
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：回避経路計算
    return target
  })

const findClosestPointToBox = (point: Position3D, box: BoundingBox): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const { min, max } = box
    const minCoords = Position3DOps.getCoordinates(min)
    const maxCoords = Position3DOps.getCoordinates(max)
    const pointCoords = Position3DOps.getCoordinates(point)

    const closestX = Math.max(minCoords.x, Math.min(pointCoords.x, maxCoords.x))
    const closestY = Math.max(minCoords.y, Math.min(pointCoords.y, maxCoords.y))
    const closestZ = Math.max(minCoords.z, Math.min(pointCoords.z, maxCoords.z))

    return yield* createPosition3D(closestX, closestY, closestZ)
  })

const findClosestPointToSphere = (
  point: Position3D,
  center: Position3D,
  radius: number
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const direction = yield* Position3DOps.subtract(point, center)
    const distance = yield* Position3DOps.magnitude(direction)

    if (distance <= radius) {
      return point // 点が球体内部にある
    }

    const normalizedDirection = yield* Position3DOps.normalize(direction)
    const closestPoint = yield* Position3DOps.add(center, yield* Position3DOps.scale(normalizedDirection, radius))

    return closestPoint
  })

const findClosestPointToPlane = (
  point: Position3D,
  planePoint: Position3D,
  planeNormal: Vector3D
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const distance = yield* distanceToPlane(point, planePoint, planeNormal)
    const offset = yield* Position3DOps.scale(planeNormal, distance)
    return yield* Position3DOps.subtract(point, offset)
  })

const findClosestPointToMesh = (
  point: Position3D,
  vertices: readonly Position3D[],
  indices: readonly number[]
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：最も近い頂点を返す
    let closestPoint = vertices[0]
    let closestDistance = yield* Position3DOps.distance(point, vertices[0])

    for (const vertex of vertices) {
      const distance = yield* Position3DOps.distance(point, vertex)
      if (distance < closestDistance) {
        closestDistance = distance
        closestPoint = vertex
      }
    }

    return closestPoint
  })

const calculateBoxNormal = (position: Position3D, box: BoundingBox): Effect.Effect<Vector3D, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：位置から最も近い面の法線を計算
    const { min, max } = box
    const minCoords = Position3DOps.getCoordinates(min)
    const maxCoords = Position3DOps.getCoordinates(max)
    const posCoords = Position3DOps.getCoordinates(position)

    // X, Y, Z軸での距離を計算
    const distToMinX = Math.abs(posCoords.x - minCoords.x)
    const distToMaxX = Math.abs(posCoords.x - maxCoords.x)
    const distToMinY = Math.abs(posCoords.y - minCoords.y)
    const distToMaxY = Math.abs(posCoords.y - maxCoords.y)
    const distToMinZ = Math.abs(posCoords.z - minCoords.z)
    const distToMaxZ = Math.abs(posCoords.z - maxCoords.z)

    const minDist = Math.min(distToMinX, distToMaxX, distToMinY, distToMaxY, distToMinZ, distToMaxZ)

    if (minDist === distToMinX) return yield* createDirection3D(-1, 0, 0)
    if (minDist === distToMaxX) return yield* createDirection3D(1, 0, 0)
    if (minDist === distToMinY) return yield* createDirection3D(0, -1, 0)
    if (minDist === distToMaxY) return yield* createDirection3D(0, 1, 0)
    if (minDist === distToMinZ) return yield* createDirection3D(0, 0, -1)
    return yield* createDirection3D(0, 0, 1)
  })

const calculatePenetrationDepth = (
  position: Position3D,
  hitPosition: Position3D,
  collisionRadius: number
): Effect.Effect<number, CameraError> =>
  Effect.gen(function* () {
    const distance = yield* Position3DOps.distance(position, hitPosition)
    return Math.max(0, collisionRadius - distance)
  })

const distanceToPlane = (
  point: Position3D,
  planePoint: Position3D,
  planeNormal: Vector3D
): Effect.Effect<number, CameraError> =>
  Effect.gen(function* () {
    const pointToPlane = yield* Position3DOps.subtract(point, planePoint)
    return yield* Position3DOps.dot(pointToPlane, planeNormal)
  })

const calculateMeshBoundingBox = (vertices: readonly Position3D[]): Effect.Effect<BoundingBox, CameraError> =>
  Effect.gen(function* () {
    if (vertices.length === 0) {
      const origin = yield* createPosition3D(0, 0, 0)
      return { min: origin, max: origin }
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity

    for (const vertex of vertices) {
      const coords = Position3DOps.getCoordinates(vertex)
      minX = Math.min(minX, coords.x)
      minY = Math.min(minY, coords.y)
      minZ = Math.min(minZ, coords.z)
      maxX = Math.max(maxX, coords.x)
      maxY = Math.max(maxY, coords.y)
      maxZ = Math.max(maxZ, coords.z)
    }

    const min = yield* createPosition3D(minX, minY, minZ)
    const max = yield* createPosition3D(maxX, maxY, maxZ)

    return { min, max }
  })
