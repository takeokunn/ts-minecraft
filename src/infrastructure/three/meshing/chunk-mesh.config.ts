// Static tile data for procedural atlas texture generation.
// Extracted here so chunk-mesh.ts stays focused on geometry and material logic.

export const DIRT_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [2,4],[6,8],[11,5],[15,10],[20,7],[25,3],[28,12],[4,18],[9,22],[18,19],[23,26],[27,20],
]

export const FOAM_DOTS: ReadonlyArray<readonly [number, number]> = [
  [3,1],[9,5],[15,1],[22,3],[27,7],[4,9],[12,13],[18,9],[25,13],[7,17],[14,17],[20,21],[2,21],[28,17],[6,25],[16,25],[24,29],
]

export const SNOW_DOTS: ReadonlyArray<readonly [number, number]> = [
  [1,2],[5,0],[9,3],[13,1],[17,4],[21,0],[25,2],[29,4],[3,8],[7,6],[11,9],[15,7],[19,10],[23,6],[27,9],
  [0,14],[4,12],[8,15],[12,13],[16,16],[20,12],[24,15],[28,13],[2,20],[6,18],[10,21],[14,19],[18,22],[22,18],[26,21],[30,19],
  [1,26],[5,24],[9,27],[13,25],[17,28],[21,24],[25,27],[29,25],
]

export const GRAVEL_SPECKLES: ReadonlyArray<readonly [number, number, number, number]> = [
  [1,2,2,2],[4,5,3,3],[7,1,2,2],[10,8,3,2],[13,4,2,3],[16,0,2,2],[19,6,3,2],[22,3,2,3],
  [25,1,2,2],[28,5,3,3],[2,10,3,2],[5,14,2,3],[8,11,2,2],[11,15,3,2],[14,12,2,2],
  [17,10,3,3],[20,14,2,2],[23,11,3,2],[26,15,2,3],[0,19,2,2],[3,22,3,3],[6,18,2,2],
  [9,23,3,2],[12,20,2,3],[15,17,2,2],[18,22,3,2],[21,19,2,2],[24,23,3,3],[27,18,2,2],
  [1,28,3,2],[4,26,2,3],[7,29,2,2],[10,27,3,2],[13,25,2,2],[16,29,3,3],[19,26,2,2],
  [22,28,3,2],[25,25,2,3],[29,27,2,2],
]

export const COBBLESTONE_PATCHES: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 1, 9, 8], [12, 1, 9, 8], [22, 1, 9, 8],
  [1, 11, 14, 8], [17, 11, 14, 8],
  [1, 21, 9, 9], [12, 21, 9, 9], [22, 21, 9, 9],
]

// Deterministic speckle positions reused across all ore tiles for consistent look.
export const ORE_SPECKLES: ReadonlyArray<readonly [number, number, number]> = [
  [3, 4, 3], [11, 2, 2], [20, 6, 3], [26, 3, 2],
  [5, 11, 2], [14, 9, 3], [22, 13, 2], [28, 15, 3],
  [2, 17, 3], [9, 20, 2], [17, 18, 3], [24, 22, 2],
  [6, 26, 2], [13, 28, 3], [21, 25, 2], [27, 29, 3],
]

// 4 brick-like panels per tile used for the metallic block sheen effect.
export const METAL_PANELS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 1, 14, 14],
  [17, 1, 14, 14],
  [1, 17, 14, 14],
  [17, 17, 14, 14],
]

export const LAVA_HOT_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [4, 6], [12, 3], [20, 9], [28, 5],
  [8, 14], [17, 17], [25, 20], [6, 22],
  [13, 26], [23, 29], [2, 12], [29, 15],
]

export const OBSIDIAN_PURPLES: ReadonlyArray<readonly [number, number]> = [
  [5, 4], [13, 11], [22, 20], [27, 8],
]
