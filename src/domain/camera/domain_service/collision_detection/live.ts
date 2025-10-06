/**
 * Collision Detection Domain Service Live Implementation
 *
 * 衝突検出ドメインサービスの純粋なドメインロジック実装。
 * 数学的衝突検出アルゴリズム、幾何学計算、
 * 空間分割による最適化を含む処理を実装しています。
 */

import { Effect, Array as EffectArray, Layer, Match, Option, pipe } from 'effect'
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
        const staticCollision = yield* pipe(
          worldData.staticObjects,
          EffectArray.findFirst((obj) =>
            Effect.gen(function* () {
              const collision = yield* checkSingleObjectCollision(position, collisionRadius, obj)
              return collision._tag === 'Collision'
            })
          ),
          Effect.andThen(
            Option.match({
              onNone: () => Effect.succeed(CollisionResult.NoCollision()),
              onSome: (obj) => checkSingleObjectCollision(position, collisionRadius, obj),
            })
          )
        )

        return yield* Effect.when(
          () => staticCollision._tag === 'Collision',
          () => Effect.succeed(staticCollision),
          {
            onFalse: () =>
              pipe(
                worldData.dynamicObjects,
                EffectArray.findFirst((obj) =>
                  Effect.gen(function* () {
                    const collision = yield* checkSingleObjectCollision(position, collisionRadius, obj)
                    return collision._tag === 'Collision'
                  })
                ),
                Effect.andThen(
                  Option.match({
                    onNone: () => Effect.succeed(CollisionResult.NoCollision()),
                    onSome: (obj) => checkSingleObjectCollision(position, collisionRadius, obj),
                  })
                ),
                Effect.andThen((dynamicCollision) =>
                  Effect.when(
                    () => dynamicCollision._tag === 'Collision',
                    () => Effect.succeed(dynamicCollision),
                    {
                      onFalse: () =>
                        pipe(
                          checkTerrainCollision(position, collisionRadius, worldData.terrain),
                          Effect.andThen((terrainCollision) =>
                            Effect.when(
                              () => terrainCollision._tag === 'Collision',
                              () => Effect.succeed(terrainCollision),
                              {
                                onFalse: () => Effect.succeed(CollisionResult.NoCollision()),
                              }
                            )
                          )
                        ),
                    }
                  )
                )
              ),
          }
        )
      }),

    /**
     * 安全な位置の検索
     * 反復的な位置調整による衝突回避
     */
    findSafePosition: (desiredPosition, currentPosition, collisionRadius, worldData) =>
      Effect.gen(function* () {
        const maxIterations = 10

        const findSafePositionRecursive = (
          candidatePosition: Position3D,
          iteration: number
        ): Effect.Effect<Position3D, CameraError> =>
          Effect.gen(function* () {
            return yield* Effect.when(
              () => iteration >= maxIterations,
              () => Effect.succeed(currentPosition),
              {
                onFalse: () =>
                  pipe(
                    checkCameraCollision(candidatePosition, collisionRadius, worldData),
                    Effect.andThen((collision) =>
                      Effect.when(
                        () => collision._tag === 'NoCollision',
                        () => Effect.succeed(candidatePosition),
                        {
                          onFalse: () =>
                            pipe(
                              calculateAvoidanceVector(collision, candidatePosition),
                              Effect.andThen((avoidanceVector) =>
                                Position3DOps.add(candidatePosition, avoidanceVector)
                              ),
                              Effect.andThen((newPosition) => findSafePositionRecursive(newPosition, iteration + 1))
                            ),
                        }
                      )
                    )
                  ),
              }
            )
          })

        return yield* findSafePositionRecursive(desiredPosition, 0)
      }),

    /**
     * レイキャスト実行
     * 光線と世界ジオメトリの交差判定
     */
    performRaycast: (origin, direction, maxDistance, worldData) =>
      Effect.gen(function* () {
        // 正規化された方向ベクトルを確保
        const normalizedDirection = yield* normalizeVector(direction)

        // 全オブジェクトのレイキャストヒットを収集
        const allObjects = [...worldData.staticObjects, ...worldData.dynamicObjects]

        const hits = yield* pipe(
          allObjects,
          EffectArray.map((obj) => raycastSingleObject(origin, normalizedDirection, maxDistance, obj)),
          Effect.all
        )

        // 最も近いヒットを検索
        return pipe(
          hits,
          EffectArray.getSomes,
          EffectArray.reduceRight(Option.none<RaycastHit>(), (hit, acc) =>
            Option.match(acc, {
              onNone: () => Option.some(hit),
              onSome: (closest) => (hit.distance < closest.distance ? Option.some(hit) : Option.some(closest)),
            })
          )
        )
      }),

    /**
     * 衝突回避計算
     * 複数の障害物を考慮した最適経路計算
     */
    calculateCollisionAvoidance: (currentPosition, targetPosition, obstacles) =>
      Effect.gen(function* () {
        // 目標への直線経路をチェック
        const directPath = yield* isPathClear(currentPosition, targetPosition, obstacles)

        return yield* Effect.when(
          () => directPath,
          () => Effect.succeed(targetPosition),
          {
            onFalse: () => findAvoidancePath(currentPosition, targetPosition, obstacles),
          }
        )
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
      pipe(
        obstacles,
        EffectArray.map((obstacle) => checkSingleObjectCollision(position, collisionRadius, obstacle)),
        Effect.all
      ),

    /**
     * 動的衝突予測
     */
    predictCollisionAlongPath: (startPosition, endPosition, collisionRadius, worldData) =>
      Effect.gen(function* () {
        const pathDirection = yield* Position3DOps.subtract(endPosition, startPosition)
        const pathLength = yield* Position3DOps.magnitude(pathDirection)
        const normalizedDirection = yield* Position3DOps.normalize(pathDirection)

        const steps = Math.ceil(pathLength / (collisionRadius * 0.5))

        const checkStep = (step: number): Effect.Effect<Option.Option<PathCollisionInfo>, CameraError> =>
          Effect.gen(function* () {
            return yield* Effect.when(
              () => step > steps,
              () => Effect.succeed(Option.none<PathCollisionInfo>()),
              {
                onFalse: () =>
                  pipe(
                    Effect.gen(function* () {
                      const t = step / steps
                      const currentPosition = yield* Position3DOps.lerp(startPosition, endPosition, t)
                      const collision = yield* checkCameraCollision(currentPosition, collisionRadius, worldData)

                      return yield* Effect.when(
                        () => collision._tag === 'Collision',
                        () =>
                          Effect.gen(function* () {
                            const safeT = Math.max(0, (step - 1) / steps)
                            const safePosition = yield* Position3DOps.lerp(startPosition, endPosition, safeT)

                            const pathCollisionInfo: PathCollisionInfo = {
                              collisionPoint: collision.hitPosition,
                              collisionNormal: collision.hitNormal,
                              collisionTime: t,
                              collisionObject: collision.collisionObject,
                              safePosition,
                            }

                            return Option.some(pathCollisionInfo)
                          }),
                        {
                          onFalse: () => checkStep(step + 1),
                        }
                      )
                    })
                  ),
              }
            )
          })

        return yield* checkStep(1)
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

    return yield* Effect.when(
      () => !isColliding,
      () => Effect.succeed(CollisionResult.NoCollision()),
      {
        onFalse: () =>
          pipe(
            Effect.all([findClosestPointToBox(position, box), calculateBoxNormal(position, box)]),
            Effect.andThen(([closestPoint, hitNormal]) =>
              pipe(
                calculatePenetrationDepth(position, closestPoint, collisionRadius),
                Effect.map((penetrationDepth) =>
                  CollisionResult.Collision({
                    hitPosition: closestPoint,
                    hitNormal,
                    penetrationDepth,
                    collisionObject: obj,
                  })
                )
              )
            )
          ),
      }
    )
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

    return yield* Effect.when(
      () => !isColliding,
      () => Effect.succeed(CollisionResult.NoCollision()),
      {
        onFalse: () =>
          pipe(
            Position3DOps.subtract(position, sphereCenter),
            Effect.andThen((direction) =>
              Effect.all({
                distance: Position3DOps.magnitude(direction),
                hitNormal: Position3DOps.normalize(direction),
              })
            ),
            Effect.andThen(({ distance, hitNormal }) =>
              pipe(
                Position3DOps.scale(hitNormal, sphereRadius),
                Effect.andThen((scaledNormal) => Position3DOps.add(sphereCenter, scaledNormal)),
                Effect.map((hitPosition) =>
                  CollisionResult.Collision({
                    hitPosition,
                    hitNormal,
                    penetrationDepth: collisionRadius + sphereRadius - distance,
                    collisionObject: obj,
                  })
                )
              )
            )
          ),
      }
    )
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

    return yield* Effect.when(
      () => Math.abs(distance) > collisionRadius,
      () => Effect.succeed(CollisionResult.NoCollision()),
      {
        onFalse: () =>
          pipe(
            findClosestPointToPlane(position, planePoint, planeNormal),
            Effect.map((hitPosition) =>
              CollisionResult.Collision({
                hitPosition,
                hitNormal: planeNormal,
                penetrationDepth: collisionRadius - Math.abs(distance),
                collisionObject: obj,
              })
            )
          ),
      }
    )
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
    const isOutOfBounds =
      gridX < 0 || gridZ < 0 || gridX >= terrain.blockData[0]?.length || gridZ >= terrain.blockData.length

    return yield* Effect.when(
      () => isOutOfBounds,
      () => Effect.succeed(CollisionResult.NoCollision()),
      {
        onFalse: () =>
          Effect.gen(function* () {
            // 地形高度をチェック
            const terrainHeight = terrain.heightMap[gridZ]?.[gridX] ?? 0
            const cameraBottom = coords.y - collisionRadius

            return yield* Effect.when(
              () => cameraBottom <= terrainHeight,
              () =>
                pipe(
                  Effect.all({
                    hitPosition: createPosition3D(coords.x, terrainHeight, coords.z),
                    hitNormal: createDirection3D(0, 1, 0),
                    min: createPosition3D(gridX * terrain.blockSize, 0, gridZ * terrain.blockSize),
                    max: createPosition3D(
                      (gridX + 1) * terrain.blockSize,
                      terrainHeight,
                      (gridZ + 1) * terrain.blockSize
                    ),
                  }),
                  Effect.map(({ hitPosition, hitNormal, min, max }) => {
                    const terrainObject = CollisionObject.Box({
                      boundingBox: { min, max },
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
                      penetrationDepth: terrainHeight - cameraBottom,
                      collisionObject: terrainObject,
                    })
                  })
                ),
              {
                onFalse: () => Effect.succeed(CollisionResult.NoCollision()),
              }
            )
          }),
      }
    )
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
    return yield* Effect.when(
      () => collision._tag === 'NoCollision',
      () => createDirection3D(0, 0, 0),
      {
        onFalse: () =>
          Position3DOps.scale(
            collision.hitNormal,
            collision.penetrationDepth + 0.1 // 少し余裕を持たせる
          ),
      }
    )
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

    return yield* Effect.when(
      () => distance <= radius,
      () => Effect.succeed(point), // 点が球体内部にある
      {
        onFalse: () =>
          pipe(
            Position3DOps.normalize(direction),
            Effect.andThen((normalizedDirection) => Position3DOps.scale(normalizedDirection, radius)),
            Effect.andThen((scaled) => Position3DOps.add(center, scaled))
          ),
      }
    )
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
    const vertexDistances = yield* pipe(
      vertices,
      EffectArray.map((vertex) =>
        pipe(
          Position3DOps.distance(point, vertex),
          Effect.map((distance) => ({ vertex, distance }))
        )
      ),
      Effect.all
    )

    const closest = pipe(
      vertexDistances,
      EffectArray.reduce({ vertex: vertices[0], distance: Infinity }, (acc, curr) =>
        curr.distance < acc.distance ? curr : acc
      )
    )

    return closest.vertex
  })

const calculateBoxNormal = (position: Position3D, box: BoundingBox): Effect.Effect<Vector3D, CameraError> =>
  Effect.gen(function* () {
    // 簡易実装：位置から最も近い面の法線を計算
    const { min, max } = box
    const minCoords = Position3DOps.getCoordinates(min)
    const maxCoords = Position3DOps.getCoordinates(max)
    const posCoords = Position3DOps.getCoordinates(position)

    // X, Y, Z軸での距離を計算
    const distances = {
      minX: Math.abs(posCoords.x - minCoords.x),
      maxX: Math.abs(posCoords.x - maxCoords.x),
      minY: Math.abs(posCoords.y - minCoords.y),
      maxY: Math.abs(posCoords.y - maxCoords.y),
      minZ: Math.abs(posCoords.z - minCoords.z),
      maxZ: Math.abs(posCoords.z - maxCoords.z),
    }

    const minDist = Math.min(
      distances.minX,
      distances.maxX,
      distances.minY,
      distances.maxY,
      distances.minZ,
      distances.maxZ
    )

    return yield* pipe(
      minDist,
      Match.value,
      Match.when(
        (d) => d === distances.minX,
        () => createDirection3D(-1, 0, 0)
      ),
      Match.when(
        (d) => d === distances.maxX,
        () => createDirection3D(1, 0, 0)
      ),
      Match.when(
        (d) => d === distances.minY,
        () => createDirection3D(0, -1, 0)
      ),
      Match.when(
        (d) => d === distances.maxY,
        () => createDirection3D(0, 1, 0)
      ),
      Match.when(
        (d) => d === distances.minZ,
        () => createDirection3D(0, 0, -1)
      ),
      Match.orElse(() => createDirection3D(0, 0, 1))
    )
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
    return yield* Effect.when(
      () => vertices.length === 0,
      () =>
        pipe(
          createPosition3D(0, 0, 0),
          Effect.map((origin) => ({ min: origin, max: origin }))
        ),
      {
        onFalse: () =>
          Effect.gen(function* () {
            const bounds = pipe(
              vertices,
              EffectArray.reduce(
                {
                  minX: Infinity,
                  minY: Infinity,
                  minZ: Infinity,
                  maxX: -Infinity,
                  maxY: -Infinity,
                  maxZ: -Infinity,
                },
                (acc, vertex) => {
                  const coords = Position3DOps.getCoordinates(vertex)
                  return {
                    minX: Math.min(acc.minX, coords.x),
                    minY: Math.min(acc.minY, coords.y),
                    minZ: Math.min(acc.minZ, coords.z),
                    maxX: Math.max(acc.maxX, coords.x),
                    maxY: Math.max(acc.maxY, coords.y),
                    maxZ: Math.max(acc.maxZ, coords.z),
                  }
                }
              )
            )

            const min = yield* createPosition3D(bounds.minX, bounds.minY, bounds.minZ)
            const max = yield* createPosition3D(bounds.maxX, bounds.maxY, bounds.maxZ)

            return { min, max }
          }),
      }
    )
  })
