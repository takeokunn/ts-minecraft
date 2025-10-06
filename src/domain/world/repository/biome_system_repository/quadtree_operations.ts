/**
 * QuadTree Operations - 完全不変関数による空間インデックス操作
 *
 * O(N²) → O(N log N) 性能改善を実現
 * 構造共有により不要なコピーを最小化
 */

import type { WorldCoordinate } from '@domain/world/value_object/coordinates/world_coordinate'
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
  // 境界外チェック - 同じ参照を返す (O(1))
  if (!coordinateInBounds(placement.coordinate, node.bounds)) {
    return node
  }

  if (node.isLeaf) {
    // 新しいbiomes配列を作成 (既存配列は不変)
    const newBiomes = [...node.biomes, placement]

    // 分割が必要か判定
    if (newBiomes.length > maxEntries && depth < maxDepth) {
      return splitNode({ ...node, biomes: newBiomes }, depth, maxDepth, maxEntries)
    }

    // 新しいリーフノードを返す
    return { ...node, biomes: newBiomes }
  } else if (node.children) {
    // 子ノードに再帰的に挿入 (構造共有)
    const newChildren = node.children.map((child) => insertNode(child, placement, depth + 1, maxDepth, maxEntries)) as [
      QuadTreeNode,
      QuadTreeNode,
      QuadTreeNode,
      QuadTreeNode,
    ]

    // 新しい内部ノードを返す (children配列のみ変更)
    return { ...node, children: newChildren }
  }

  return node
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
  const midX = ((bounds.minX + bounds.maxX) / 2) as WorldCoordinate
  const midZ = ((bounds.minZ + bounds.maxZ) / 2) as WorldCoordinate

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
  // 境界が交差しない場合は早期リターン
  if (!boundsIntersect(node.bounds, bounds)) {
    return
  }

  if (node.isLeaf) {
    // リーフノードの場合、全バイオームをチェック
    node.biomes.filter((biome) => coordinateInBounds(biome.coordinate, bounds)).forEach((biome) => results.push(biome))
  } else if (node.children) {
    // 内部ノードの場合、子ノードを再帰検索
    node.children.forEach((child) => queryNode(child, bounds, results))
  }
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
  let nearest: BiomePlacement | null = null
  let minDistance = maxDistance

  // 検索範囲の境界を作成
  const searchBounds: SpatialBounds = {
    minX: (coordinate.x - maxDistance) as WorldCoordinate,
    minZ: (coordinate.z - maxDistance) as WorldCoordinate,
    maxX: (coordinate.x + maxDistance) as WorldCoordinate,
    maxZ: (coordinate.z + maxDistance) as WorldCoordinate,
  }

  // 範囲内の候補を取得
  const candidates = query(state, searchBounds)

  // 最も近いバイオームを検索
  return candidates.reduce<BiomePlacement | undefined>((nearest, candidate) => {
    const distance = calculateDistance(coordinate, candidate.coordinate)
    if (!nearest || distance < calculateDistance(coordinate, nearest.coordinate)) {
      return candidate
    }
    return nearest
  }, undefined)
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

    if (node.isLeaf) {
      stats.leafNodes++
      stats.totalBiomes += node.biomes.length
    } else if (node.children) {
      node.children.forEach((child) => traverse(child, depth + 1))
    }
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
