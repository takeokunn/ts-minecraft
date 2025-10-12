/**
 * QuadTree Operations - 完全不変関数による空間インデックス操作
 *
 * O(N²) → O(N log N) 性能改善を実現
 * 構造共有により不要なコピーを最小化
 */

import { makeUnsafeWorldX, makeUnsafeWorldZ } from '@/domain/biome/value_object/coordinates'
import { Match, Option, pipe } from 'effect'
import type { BiomePlacement, QuadTreeNode, QuadTreeState, SpatialBounds, SpatialCoordinate } from './quadtree_schema'

// === Helper Functions ===

/**
 * 座標が境界内にあるか判定
 */
const coordinateInBounds = (coord: SpatialCoordinate, bounds: SpatialBounds): boolean => {
  return coord.x >= bounds.minX && coord.x <= bounds.maxX && coord.z >= bounds.minZ && coord.z <= bounds.maxZ
}

/**
 * 2つの境界が交差するか判定
 */
const boundsIntersect = (a: SpatialBounds, b: SpatialBounds): boolean => {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ)
}

/**
 * 2点間の距離を計算
 */
const calculateDistance = (a: SpatialCoordinate, b: SpatialCoordinate): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * リーフノードを作成
 */
const createLeafNode = (bounds: SpatialBounds): QuadTreeNode => ({
  bounds,
  biomes: [],
  isLeaf: true,
})

// === Core QuadTree Operations ===

/**
 * QuadTreeの初期状態を作成
 *
 * @param bounds - 空間境界
 * @param maxDepth - 最大深度 (デフォルト: 8)
 * @param maxEntries - ノードあたりの最大エントリ数 (デフォルト: 16)
 * @returns 初期QuadTree状態
 */
export const createQuadTree = (
  bounds: SpatialBounds,
  maxDepth: number = 8,
  maxEntries: number = 16
): QuadTreeState => ({
  root: createLeafNode(bounds),
  maxDepth,
  maxEntries,
})

/**
 * バイオーム配置を挿入 (完全不変・構造共有)
 *
 * 重要: 変更されていないノードは同じ参照を保持 → 効率的なメモリ使用
 *
 * @param state - 現在のQuadTree状態
 * @param placement - 挿入するバイオーム配置
 * @returns 新しいQuadTree状態
 */
export const insertPlacement = (state: QuadTreeState, placement: BiomePlacement): QuadTreeState => {
  const newRoot = insertNode(state.root, placement, 0, state.maxDepth, state.maxEntries)
  return { ...state, root: newRoot }
}

/**
 * ノードに配置を挿入 (内部関数・再帰)
 *
 * 構造共有の実装:
 * - 境界外の場合: 同じノード参照を返す (コピー不要)
 * - リーフノードの場合: 新しいbiomes配列を持つ新ノードを返す
 * - 分割が必要な場合: splitNodeを呼び出す
 * - 内部ノードの場合: 変更された子のみ新しい参照を持つ
 */
const insertNode = (
  node: QuadTreeNode,
  placement: BiomePlacement,
  depth: number,
  maxDepth: number,
  maxEntries: number
): QuadTreeNode => {
  return pipe(
    Match.value(coordinateInBounds(placement.coordinate, node.bounds)),
    Match.when(false, () => node),
    Match.orElse(() =>
      pipe(
        Match.value(node.isLeaf),
        Match.when(true, () => {
          const newBiomes = [...node.biomes, placement]

          return pipe(
            Match.value(newBiomes.length > maxEntries && depth < maxDepth),
            Match.when(true, () => splitNode({ ...node, biomes: newBiomes }, depth, maxDepth, maxEntries)),
            Match.orElse(() => ({ ...node, biomes: newBiomes }))
          )
        }),
        Match.orElse(() =>
          pipe(
            Option.fromNullable(node.children),
            Option.match({
              onNone: () => node,
              onSome: (children) => {
                const newChildren = children.map((child) =>
                  insertNode(child, placement, depth + 1, maxDepth, maxEntries)
                ) as [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode]

                return { ...node, children: newChildren }
              },
            })
          )
        )
      )
    )
  )
}

/**
 * ノードを4つの象限に分割
 *
 * @param node - 分割するノード
 * @param depth - 現在の深度
 * @param maxDepth - 最大深度
 * @param maxEntries - 最大エントリ数
 * @returns 分割後のノード
 */
const splitNode = (node: QuadTreeNode, depth: number, maxDepth: number, maxEntries: number): QuadTreeNode => {
  const { bounds, biomes } = node
  const midX = makeUnsafeWorldX((bounds.minX + bounds.maxX) / 2)
  const midZ = makeUnsafeWorldZ((bounds.minZ + bounds.maxZ) / 2)

  // 4つの子象限を作成
  let nw = createLeafNode({ minX: bounds.minX, minZ: midZ, maxX: midX, maxZ: bounds.maxZ })
  let ne = createLeafNode({ minX: midX, minZ: midZ, maxX: bounds.maxX, maxZ: bounds.maxZ })
  let sw = createLeafNode({ minX: bounds.minX, minZ: bounds.minZ, maxX: midX, maxZ: midZ })
  let se = createLeafNode({ minX: midX, minZ: bounds.minZ, maxX: bounds.maxX, maxZ: midZ })

  // 既存のバイオームを子ノードに再配置
  // insertNodeは境界チェックするので、各バイオームは正しい象限にのみ挿入される
  ;[nw, ne, sw, se] = biomes.reduce(
    (children, biome) =>
      children.map((child) => insertNode(child, biome, depth + 1, maxDepth, maxEntries)) as [
        QuadTreeNode,
        QuadTreeNode,
        QuadTreeNode,
        QuadTreeNode,
      ],
    [nw, ne, sw, se] as [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode]
  )

  return {
    bounds,
    biomes: [],
    isLeaf: false,
    children: [nw, ne, sw, se],
  }
}

/**
 * 指定された境界内のバイオーム配置を検索
 *
 * @param state - QuadTree状態
 * @param bounds - 検索範囲
 * @returns 見つかったバイオーム配置の配列
 */
export const query = (state: QuadTreeState, bounds: SpatialBounds): ReadonlyArray<BiomePlacement> => {
  const results: BiomePlacement[] = []
  queryNode(state.root, bounds, results)
  return results
}

/**
 * ノード内を検索 (内部関数・再帰)
 */
const queryNode = (node: QuadTreeNode, bounds: SpatialBounds, results: BiomePlacement[]): void => {
  pipe(
    Match.value(boundsIntersect(node.bounds, bounds)),
    Match.when(false, () => undefined),
    Match.orElse(() =>
      pipe(
        Match.value(node.isLeaf),
        Match.when(true, () =>
          node.biomes
            .filter((biome) => coordinateInBounds(biome.coordinate, bounds))
            .forEach((biome) => results.push(biome))
        ),
        Match.orElse(() =>
          pipe(
            Option.fromNullable(node.children),
            Option.match({
              onNone: () => undefined,
              onSome: (children) => children.forEach((child) => queryNode(child, bounds, results)),
            })
          )
        )
      )
    )
  )
}

/**
 * 最も近いバイオームを検索
 *
 * @param state - QuadTree状態
 * @param coordinate - 検索の中心座標
 * @param maxDistance - 最大検索距離 (デフォルト: Infinity)
 * @returns 最も近いバイオーム配置 (見つからない場合はnull)
 */
export const findNearestBiome = (
  state: QuadTreeState,
  coordinate: SpatialCoordinate,
  maxDistance: number = Infinity
): BiomePlacement | null => {
  // 検索範囲の境界を作成
  const searchBounds: SpatialBounds = {
    minX: makeUnsafeWorldX(coordinate.x - maxDistance),
    minZ: makeUnsafeWorldZ(coordinate.z - maxDistance),
    maxX: makeUnsafeWorldX(coordinate.x + maxDistance),
    maxZ: makeUnsafeWorldZ(coordinate.z + maxDistance),
  }

  // 範囲内の候補を取得
  const candidates = query(state, searchBounds)

  // 最も近いバイオームを検索
  const nearest = candidates.reduce<BiomePlacement | undefined>((currentNearest, candidate) => {
    const candidateDistance = calculateDistance(coordinate, candidate.coordinate)

    return pipe(
      Option.fromNullable(currentNearest),
      Option.match({
        onNone: () => (candidateDistance <= maxDistance ? candidate : undefined),
        onSome: (existing) =>
          candidateDistance < calculateDistance(coordinate, existing.coordinate) ? candidate : existing,
      })
    )
  }, undefined)

  return nearest ?? null
}

/**
 * QuadTreeの統計情報を取得
 *
 * @param state - QuadTree状態
 * @returns 統計情報
 */
export const getStatistics = (
  state: QuadTreeState
): {
  totalNodes: number
  leafNodes: number
  totalBiomes: number
  averageDepth: number
  maxDepth: number
} => {
  const stats = {
    totalNodes: 0,
    leafNodes: 0,
    totalBiomes: 0,
    depthSum: 0,
    maxDepthFound: 0,
  }

  const traverse = (node: QuadTreeNode, depth: number): void => {
    stats.totalNodes++
    stats.depthSum += depth
    stats.maxDepthFound = Math.max(stats.maxDepthFound, depth)

    pipe(
      Match.value(node.isLeaf),
      Match.when(true, () => {
        stats.leafNodes++
        stats.totalBiomes += node.biomes.length
      }),
      Match.orElse(() =>
        pipe(
          Option.fromNullable(node.children),
          Option.match({
            onNone: () => undefined,
            onSome: (children) => children.forEach((child) => traverse(child, depth + 1)),
          })
        )
      )
    )
  }

  traverse(state.root, 0)

  return {
    totalNodes: stats.totalNodes,
    leafNodes: stats.leafNodes,
    totalBiomes: stats.totalBiomes,
    averageDepth: stats.totalNodes > 0 ? stats.depthSum / stats.totalNodes : 0,
    maxDepth: stats.maxDepthFound,
  }
}
