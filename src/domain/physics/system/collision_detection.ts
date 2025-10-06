import type { BlockTypeId } from '@domain/entities'
import type { AABB, CollisionResult } from '@domain/physics/types'
import { Effect, Match, Option, pipe, Stream } from 'effect'
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
  getNearbyBlockAABBs: (position: Vector3, radius: number = 2): Array<{ position: Vector3; aabb: AABB }> => {
    const blocks: Array<{ position: Vector3; aabb: AABB }> = []
    const minX = Math.floor(position.x - radius)
    const maxX = Math.ceil(position.x + radius)
    const minY = Math.floor(position.y - radius)
    const maxY = Math.ceil(position.y + radius)
    const minZ = Math.floor(position.z - radius)
    const maxZ = Math.ceil(position.z + radius)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const blockPos = { x, y, z }
          // ブロックは1x1x1のAABB
          const blockAABB: AABB = {
            _tag: 'AABB' as const,
            min: { x, y, z },
            max: { x: x + 1, y: y + 1, z: z + 1 },
          } as AABB
          blocks.push({ position: blockPos, aabb: blockAABB })
        }
      }
    }

    return blocks
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
      let newPosition = {
        x: position.x + velocity.x * deltaTime,
        y: position.y + velocity.y * deltaTime,
        z: position.z + velocity.z * deltaTime,
      }
      let newVelocity = { ...velocity }
      let isGrounded = false
      const collidedAxes = { x: false, y: false, z: false }
      const nearbyBlocks: Array<{ position: Vector3; blockType: BlockTypeId }> = []

      // エンティティボックスを新しい位置に移動
      const movedBox = CollisionDetection.translateAABB(entityBox, newPosition)

      // 周囲のブロックを取得
      const blockAABBs = CollisionDetection.getNearbyBlockAABBs(newPosition, 3)

      // 各軸ごとに衝突をチェック（スイープアルゴリズム）- Streamで関数型変換
      yield* pipe(
        Stream.fromIterable(blockAABBs),
        Stream.mapEffect(({ position: blockPos, aabb: blockAABB }) =>
          Effect.gen(function* () {
            const blockType = getBlockAt(blockPos)

            // 空気ブロックはスキップ - continue相当をfilterで実現
            return yield* pipe(
              !blockType || blockType === 0,
              Match.value,
              Match.when(false, () => Effect.succeed(Option.some({ blockType: blockType!, blockPos, blockAABB }))),
              Match.orElse(() => Effect.succeed(Option.none())) // true case - continue相当
            )
          })
        ),
        Stream.filterMap((option) => option), // Option.none()を除外（continue相当）
        Stream.mapEffect(({ blockType, blockPos, blockAABB }) =>
          Effect.gen(function* () {
            nearbyBlocks.push({ position: blockPos, blockType: blockType as BlockTypeId })

            // Y軸の衝突チェック（重力方向）
            const yTestBox = CollisionDetection.translateAABB(entityBox, {
              x: position.x,
              y: newPosition.y,
              z: position.z,
            })
            pipe(
              CollisionDetection.intersectsAABB(yTestBox, blockAABB),
              Match.value,
              Match.when(false, () => {}),
              Match.orElse(() => {
                collidedAxes.y = true
                pipe(
                  Match.value(velocity.y),
                  Match.when(
                    (vy) => vy < 0,
                    () => {
                      // 下方向への衝突（着地）
                      newPosition.y = blockAABB.max.y - entityBox.min.y
                      newVelocity.y = 0
                      isGrounded = true
                    }
                  ),
                  Match.when(
                    (vy) => vy > 0,
                    () => {
                      // 上方向への衝突（頭打ち）
                      newPosition.y = blockAABB.min.y - entityBox.max.y
                      newVelocity.y = 0
                    }
                  ),
                  Match.orElse(() => {})
                )
              })
            )

            // X軸の衝突チェック
            const xTestBox = CollisionDetection.translateAABB(entityBox, {
              x: newPosition.x,
              y: position.y,
              z: position.z,
            })
            pipe(
              CollisionDetection.intersectsAABB(xTestBox, blockAABB),
              Match.value,
              Match.when(false, () => {}),
              Match.orElse(() => {
                collidedAxes.x = true
                pipe(
                  Match.value(velocity.x),
                  Match.when(
                    (vx) => vx > 0,
                    () => {
                      newPosition.x = blockAABB.min.x - entityBox.max.x
                    }
                  ),
                  Match.when(
                    (vx) => vx < 0,
                    () => {
                      newPosition.x = blockAABB.max.x - entityBox.min.x
                    }
                  ),
                  Match.orElse(() => {})
                )
                newVelocity.x = 0
              })
            )

            // Z軸の衝突チェック
            const zTestBox = CollisionDetection.translateAABB(entityBox, {
              x: position.x,
              y: position.y,
              z: newPosition.z,
            })
            pipe(
              CollisionDetection.intersectsAABB(zTestBox, blockAABB),
              Match.value,
              Match.when(false, () => {}),
              Match.orElse(() => {
                collidedAxes.z = true
                pipe(
                  Match.value(velocity.z),
                  Match.when(
                    (vz) => vz > 0,
                    () => {
                      newPosition.z = blockAABB.min.z - entityBox.max.z
                    }
                  ),
                  Match.when(
                    (vz) => vz < 0,
                    () => {
                      newPosition.z = blockAABB.max.z - entityBox.min.z
                    }
                  ),
                  Match.orElse(() => {})
                )
                newVelocity.z = 0
              })
            )
          })
        ),
        Stream.runDrain
      )

      // 階段の自動登り処理 - Match pattern で if文を置き換え
      const stepCondition = (collidedAxes.x || collidedAxes.z) && !collidedAxes.y && isGrounded

      const canStepResult = pipe(
        stepCondition,
        Match.value,
        Match.when(false, () => false),
        Match.orElse(() => {
          const stepHeight = 0.5
          const stepTestPos = {
            x: newPosition.x,
            y: position.y + stepHeight,
            z: newPosition.z,
          }
          const stepTestBox = CollisionDetection.translateAABB(entityBox, stepTestPos)

          // ステップ可能性をArray.everyで判定（break相当を関数型で実現）
          const canStep = blockAABBs.every(({ position: blockPos, aabb: blockAABB }) => {
            const blockType = getBlockAt(blockPos)
            return pipe(
              blockType && blockType !== 0,
              Match.value,
              Match.when(false, () => true), // ブロックなし = ステップ可能
              Match.orElse(() => {
                return pipe(
                  CollisionDetection.intersectsAABB(stepTestBox, blockAABB),
                  Match.value,
                  Match.when(false, () => true), // 衝突なし = ステップ可能
                  Match.orElse(() => false) // 衝突あり = ステップ不可
                )
              })
            )
          })

          return canStep
        })
      )

      pipe(
        canStepResult,
        Match.value,
        Match.when(false, () => {}),
        Match.orElse(() => {
          // 階段を登れる場合、Y位置を更新
          newPosition.y = position.y + 0.5
          // 水平方向の移動は継続
          newPosition.x = position.x + velocity.x * deltaTime
          newPosition.z = position.z + velocity.z * deltaTime
          collidedAxes.x = false
          collidedAxes.z = false
        })
      )

      return {
        position: newPosition,
        velocity: newVelocity,
        isGrounded,
        collidedAxes,
        nearbyBlocks,
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
