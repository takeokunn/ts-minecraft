import type { BlockTypeId } from '@domain/entities'
import type { AABB, CollisionResult } from '@domain/physics/types'
import { Effect, Match, Option, pipe, Array as ReadonlyArray, Stream } from 'effect'
import type { Vector3 } from '../../world/types'

/**
 * AABB衝突検出システム
 * Axis-Aligned Bounding Boxを使用した高速な衝突判定
 */
export const CollisionDetection = {
  /**
   * 2つのAABBが衝突しているか判定
   */
  intersectsAABB: (box1: AABB, box2: AABB): boolean => {
    return (
      box1.max.x >= box2.min.x &&
      box1.min.x <= box2.max.x &&
      box1.max.y >= box2.min.y &&
      box1.min.y <= box2.max.y &&
      box1.max.z >= box2.min.z &&
      box1.min.z <= box2.max.z
    )
  },

  /**
   * AABBを位置に基づいて移動
   */
  translateAABB: (box: AABB, offset: Vector3): AABB =>
    ({
      _tag: 'AABB' as const,
      min: {
        x: box.min.x + offset.x,
        y: box.min.y + offset.y,
        z: box.min.z + offset.z,
      },
      max: {
        x: box.max.x + offset.x,
        y: box.max.y + offset.y,
        z: box.max.z + offset.z,
      },
    }) as AABB,

  /**
   * エンティティの周囲のブロックAABBを取得
   */
  getNearbyBlockAABBs: (position: Vector3, radius: number = 2): ReadonlyArray<{ position: Vector3; aabb: AABB }> => {
    const minX = Math.floor(position.x - radius)
    const maxX = Math.ceil(position.x + radius)
    const minY = Math.floor(position.y - radius)
    const maxY = Math.ceil(position.y + radius)
    const minZ = Math.floor(position.z - radius)
    const maxZ = Math.ceil(position.z + radius)

    // 3重ネストfor文をReadonlyArray.flatMapで宣言的に変換
    return pipe(
      Array.from({ length: maxX - minX + 1 }, (_, i) => minX + i),
      (xRange) =>
        xRange.flatMap((x) =>
          Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i).flatMap((y) =>
            Array.from({ length: maxZ - minZ + 1 }, (_, i) => minZ + i).map((z) => ({
              position: { x, y, z },
              aabb: {
                _tag: 'AABB' as const,
                min: { x, y, z },
                max: { x: x + 1, y: y + 1, z: z + 1 },
              } as AABB,
            }))
          )
        )
    )
  },

  /**
   * 衝突検出と応答
   * @param position 現在位置
   * @param velocity 速度ベクトル
   * @param entityBox エンティティのAABB
   * @param getBlockAt ブロック取得関数（World統合用）
   */
  detectCollision: (
    position: Vector3,
    velocity: Vector3,
    entityBox: AABB,
    getBlockAt: (pos: Vector3) => BlockTypeId | null
  ): Effect.Effect<CollisionResult> =>
    Effect.gen(function* () {
      const deltaTime = 1 / 60 // 60 FPS想定
      const initialPosition = {
        x: position.x + velocity.x * deltaTime,
        y: position.y + velocity.y * deltaTime,
        z: position.z + velocity.z * deltaTime,
      }

      // 周囲のブロックを取得
      const blockAABBs = CollisionDetection.getNearbyBlockAABBs(initialPosition, 3)

      // 衝突処理の状態を累積する型
      type CollisionState = {
        position: Vector3
        velocity: Vector3
        isGrounded: boolean
        collidedAxes: { x: boolean; y: boolean; z: boolean }
        nearbyBlocks: ReadonlyArray<{ position: Vector3; blockType: BlockTypeId }>
      }

      // Stream.reduceで状態を累積（mutable変数削除）
      const collisionResult = yield* pipe(
        Stream.fromIterable(blockAABBs),
        Stream.mapEffect(({ position: blockPos, aabb: blockAABB }) =>
          Effect.gen(function* () {
            const blockType = getBlockAt(blockPos)

            // 空気ブロックはスキップ
            return yield* pipe(
              !blockType || blockType === 0,
              Match.value,
              Match.when(false, () => Effect.succeed(Option.some({ blockType: blockType!, blockPos, blockAABB }))),
              Match.orElse(() => Effect.succeed(Option.none()))
            )
          })
        ),
        Stream.filterMap((option) => option),
        Stream.runFold(
          {
            position: initialPosition,
            velocity: { ...velocity },
            isGrounded: false,
            collidedAxes: { x: false, y: false, z: false },
            nearbyBlocks: [] as ReadonlyArray<{ position: Vector3; blockType: BlockTypeId }>,
          } as CollisionState,
          (state, { blockType, blockPos, blockAABB }) => {
            // nearbyBlocksに追加
            const updatedNearbyBlocks = [
              ...state.nearbyBlocks,
              { position: blockPos, blockType: blockType as BlockTypeId },
            ]

            // Y軸の衝突チェック
            const yTestBox = CollisionDetection.translateAABB(entityBox, {
              x: position.x,
              y: state.position.y,
              z: position.z,
            })

            const yCollisionState = pipe(
              CollisionDetection.intersectsAABB(yTestBox, blockAABB),
              Match.value,
              Match.when(false, () => state),
              Match.orElse(() => {
                const updatedCollidedAxes = { ...state.collidedAxes, y: true }
                return pipe(
                  Match.value(velocity.y),
                  Match.when(
                    (vy) => vy < 0,
                    () => ({
                      ...state,
                      position: { ...state.position, y: blockAABB.max.y - entityBox.min.y },
                      velocity: { ...state.velocity, y: 0 },
                      isGrounded: true,
                      collidedAxes: updatedCollidedAxes,
                      nearbyBlocks: updatedNearbyBlocks,
                    })
                  ),
                  Match.when(
                    (vy) => vy > 0,
                    () => ({
                      ...state,
                      position: { ...state.position, y: blockAABB.min.y - entityBox.max.y },
                      velocity: { ...state.velocity, y: 0 },
                      collidedAxes: updatedCollidedAxes,
                      nearbyBlocks: updatedNearbyBlocks,
                    })
                  ),
                  Match.orElse(() => ({
                    ...state,
                    collidedAxes: updatedCollidedAxes,
                    nearbyBlocks: updatedNearbyBlocks,
                  }))
                )
              })
            )

            // X軸の衝突チェック
            const xTestBox = CollisionDetection.translateAABB(entityBox, {
              x: yCollisionState.position.x,
              y: position.y,
              z: position.z,
            })

            const xCollisionState = pipe(
              CollisionDetection.intersectsAABB(xTestBox, blockAABB),
              Match.value,
              Match.when(false, () => yCollisionState),
              Match.orElse(() => {
                const updatedCollidedAxes = { ...yCollisionState.collidedAxes, x: true }
                return pipe(
                  Match.value(velocity.x),
                  Match.when(
                    (vx) => vx > 0,
                    () => ({
                      ...yCollisionState,
                      position: { ...yCollisionState.position, x: blockAABB.min.x - entityBox.max.x },
                      velocity: { ...yCollisionState.velocity, x: 0 },
                      collidedAxes: updatedCollidedAxes,
                    })
                  ),
                  Match.when(
                    (vx) => vx < 0,
                    () => ({
                      ...yCollisionState,
                      position: { ...yCollisionState.position, x: blockAABB.max.x - entityBox.min.x },
                      velocity: { ...yCollisionState.velocity, x: 0 },
                      collidedAxes: updatedCollidedAxes,
                    })
                  ),
                  Match.orElse(() => ({ ...yCollisionState, collidedAxes: updatedCollidedAxes }))
                )
              })
            )

            // Z軸の衝突チェック
            const zTestBox = CollisionDetection.translateAABB(entityBox, {
              x: position.x,
              y: position.y,
              z: xCollisionState.position.z,
            })

            const zCollisionState = pipe(
              CollisionDetection.intersectsAABB(zTestBox, blockAABB),
              Match.value,
              Match.when(false, () => xCollisionState),
              Match.orElse(() => {
                const updatedCollidedAxes = { ...xCollisionState.collidedAxes, z: true }
                return pipe(
                  Match.value(velocity.z),
                  Match.when(
                    (vz) => vz > 0,
                    () => ({
                      ...xCollisionState,
                      position: { ...xCollisionState.position, z: blockAABB.min.z - entityBox.max.z },
                      velocity: { ...xCollisionState.velocity, z: 0 },
                      collidedAxes: updatedCollidedAxes,
                    })
                  ),
                  Match.when(
                    (vz) => vz < 0,
                    () => ({
                      ...xCollisionState,
                      position: { ...xCollisionState.position, z: blockAABB.max.z - entityBox.min.z },
                      velocity: { ...xCollisionState.velocity, z: 0 },
                      collidedAxes: updatedCollidedAxes,
                    })
                  ),
                  Match.orElse(() => ({ ...xCollisionState, collidedAxes: updatedCollidedAxes }))
                )
              })
            )

            return zCollisionState
          }
        )
      )

      // 階段の自動登り処理
      const stepCondition =
        (collisionResult.collidedAxes.x || collisionResult.collidedAxes.z) &&
        !collisionResult.collidedAxes.y &&
        collisionResult.isGrounded

      const canStepResult = pipe(
        stepCondition,
        Match.value,
        Match.when(false, () => false),
        Match.orElse(() => {
          const stepHeight = 0.5
          const stepTestPos = {
            x: collisionResult.position.x,
            y: position.y + stepHeight,
            z: collisionResult.position.z,
          }
          const stepTestBox = CollisionDetection.translateAABB(entityBox, stepTestPos)

          const canStep = blockAABBs.every(({ position: blockPos, aabb: blockAABB }) => {
            const blockType = getBlockAt(blockPos)
            return pipe(
              blockType && blockType !== 0,
              Match.value,
              Match.when(false, () => true),
              Match.orElse(() => {
                return pipe(
                  CollisionDetection.intersectsAABB(stepTestBox, blockAABB),
                  Match.value,
                  Match.when(false, () => true),
                  Match.orElse(() => false)
                )
              })
            )
          })

          return canStep
        })
      )

      const finalResult = pipe(
        canStepResult,
        Match.value,
        Match.when(false, () => collisionResult),
        Match.orElse(() => ({
          ...collisionResult,
          position: {
            x: position.x + velocity.x * deltaTime,
            y: position.y + 0.5,
            z: position.z + velocity.z * deltaTime,
          },
          collidedAxes: { ...collisionResult.collidedAxes, x: false, z: false },
        }))
      )

      return {
        position: finalResult.position,
        velocity: finalResult.velocity,
        isGrounded: finalResult.isGrounded,
        collidedAxes: finalResult.collidedAxes,
        nearbyBlocks: finalResult.nearbyBlocks,
      }
    }),

  /**
   * レイキャスト - 視線判定用
   */
  raycast: (
    origin: Vector3,
    direction: Vector3,
    maxDistance: number,
    getBlockAt: (pos: Vector3) => BlockTypeId | null
  ): Effect.Effect<{ hit: boolean; position?: Vector3; blockType?: BlockTypeId }> =>
    Effect.gen(function* () {
      const step = 0.1
      const steps = Math.floor(maxDistance / step)

      // for loop を Stream に変換して if文を elimination
      return yield* pipe(
        Stream.range(0, steps),
        Stream.mapEffect((i) =>
          Effect.gen(function* () {
            const t = i * step
            const point = {
              x: origin.x + direction.x * t,
              y: origin.y + direction.y * t,
              z: origin.z + direction.z * t,
            }

            const blockPos = {
              x: Math.floor(point.x),
              y: Math.floor(point.y),
              z: Math.floor(point.z),
            }

            const blockType = getBlockAt(blockPos)

            // if文をMatch patternで置き換え、Option型で表現
            return yield* pipe(
              blockType !== null && blockType !== 0,
              Match.value,
              Match.when(false, () => Effect.succeed(Option.none())),
              Match.when(true, () =>
                Effect.succeed(Option.some({ hit: true, position: point, blockType: blockType as BlockTypeId }))
              ),
              Match.exhaustive
            )
          })
        ),
        Stream.filterMap((option) => option), // Option.none()を除外
        Stream.runHead, // 最初のヒット結果を取得（早期終了相当）
        Effect.map(
          Option.match({
            onNone: () => ({ hit: false }), // ヒットなし
            onSome: (result) => result, // ヒットあり
          })
        )
      )
    }),
}
