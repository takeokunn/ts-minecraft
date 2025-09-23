import { Effect } from 'effect'
import { Vector3 } from '../world/types'
import { BlockTypeId } from '../../shared/types/branded'
import { AABB, CollisionResult } from './types'

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
  translateAABB: (box: AABB, offset: Vector3): AABB => ({
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
  }),

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
          }
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

      // 各軸ごとに衝突をチェック（スイープアルゴリズム）
      for (const { position: blockPos, aabb: blockAABB } of blockAABBs) {
        const blockType = getBlockAt(blockPos)
        if (!blockType || blockType === 0) continue // 空気ブロックはスキップ

        nearbyBlocks.push({ position: blockPos, blockType })

        // Y軸の衝突チェック（重力方向）
        const yTestBox = CollisionDetection.translateAABB(entityBox, {
          x: position.x,
          y: newPosition.y,
          z: position.z,
        })
        if (CollisionDetection.intersectsAABB(yTestBox, blockAABB)) {
          collidedAxes.y = true
          if (velocity.y < 0) {
            // 下方向への衝突（着地）
            newPosition.y = blockAABB.max.y - entityBox.min.y
            newVelocity.y = 0
            isGrounded = true
          } else if (velocity.y > 0) {
            // 上方向への衝突（頭打ち）
            newPosition.y = blockAABB.min.y - entityBox.max.y
            newVelocity.y = 0
          }
        }

        // X軸の衝突チェック
        const xTestBox = CollisionDetection.translateAABB(entityBox, {
          x: newPosition.x,
          y: position.y,
          z: position.z,
        })
        if (CollisionDetection.intersectsAABB(xTestBox, blockAABB)) {
          collidedAxes.x = true
          if (velocity.x > 0) {
            newPosition.x = blockAABB.min.x - entityBox.max.x
          } else if (velocity.x < 0) {
            newPosition.x = blockAABB.max.x - entityBox.min.x
          }
          newVelocity.x = 0
        }

        // Z軸の衝突チェック
        const zTestBox = CollisionDetection.translateAABB(entityBox, {
          x: position.x,
          y: position.y,
          z: newPosition.z,
        })
        if (CollisionDetection.intersectsAABB(zTestBox, blockAABB)) {
          collidedAxes.z = true
          if (velocity.z > 0) {
            newPosition.z = blockAABB.min.z - entityBox.max.z
          } else if (velocity.z < 0) {
            newPosition.z = blockAABB.max.z - entityBox.min.z
          }
          newVelocity.z = 0
        }
      }

      // 階段の自動登り処理
      if ((collidedAxes.x || collidedAxes.z) && !collidedAxes.y && isGrounded) {
        const stepHeight = 0.5 // 半ブロック分
        const stepTestPos = {
          x: newPosition.x,
          y: position.y + stepHeight,
          z: newPosition.z,
        }
        const stepTestBox = CollisionDetection.translateAABB(entityBox, stepTestPos)

        let canStep = true
        for (const { position: blockPos, aabb: blockAABB } of blockAABBs) {
          const blockType = getBlockAt(blockPos)
          if (blockType && blockType !== 0) {
            // 上昇後の位置で衝突チェック
            if (CollisionDetection.intersectsAABB(stepTestBox, blockAABB)) {
              canStep = false
              break
            }
          }
        }

        if (canStep) {
          // 階段を登れる場合、Y位置を更新
          newPosition.y = position.y + stepHeight
          // 水平方向の移動は継続
          newPosition.x = position.x + velocity.x * deltaTime
          newPosition.z = position.z + velocity.z * deltaTime
          collidedAxes.x = false
          collidedAxes.z = false
        }
      }

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

      for (let i = 0; i <= steps; i++) {
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
        if (blockType && blockType !== 0) {
          return { hit: true, position: blockPos, blockType }
        }
      }

      return { hit: false }
    }),
}