import type { Position, Vector3 } from '@ts-minecraft/core'

// Voxel A* for chase detours. Mobs normally steer straight at the player;
// when that line is blocked (they bump a wall and start hopping), this finds
// a short walkable route and returns the direction to its first waypoint.
// Node-capped so a fully enclosed target degrades to null (caller keeps the
// straight steering + hop fallback) instead of burning the frame budget.

export type SolidProbe = (position: Position) => boolean

const MAX_STEP_UP = 1
const MAX_DROP = 2
export const PATHFINDING_MAX_NODES = 192
// Horizontal goal tolerance: standing in the voxel next to the player counts.
const GOAL_TOLERANCE_SQ = 2.25

type Node = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly g: number
  readonly f: number
  readonly parent: Node | null
}

const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`

const heuristic = (x: number, z: number, goalX: number, goalZ: number): number =>
  Math.abs(goalX - x) + Math.abs(goalZ - z)

const isAir = (isSolid: SolidProbe, x: number, y: number, z: number): boolean =>
  !isSolid({ x: x + 0.5, y, z: z + 0.5 })

// A mob can stand at (x, y, z) when feet+head are air and the floor is solid.
const isStandable = (isSolid: SolidProbe, x: number, y: number, z: number): boolean =>
  isAir(isSolid, x, y, z) && isAir(isSolid, x, y + 1, z) && !isAir(isSolid, x, y - 1, z)

// Resolve the y a mob ends up at when moving horizontally into column (x, z)
// from height y: same level, one step up, or a short drop. null = impassable.
const resolveMoveY = (isSolid: SolidProbe, x: number, y: number, z: number): number | null => {
  if (isStandable(isSolid, x, y, z)) return y
  // step up (needs headroom above the current level too)
  if (
    isAir(isSolid, x, y + MAX_STEP_UP + 1, z)
    && isStandable(isSolid, x, y + MAX_STEP_UP, z)
  ) return y + MAX_STEP_UP
  // drop down
  for (let drop = 1; drop <= MAX_DROP; drop++) {
    if (!isAir(isSolid, x, y - drop + 1, z)) break
    if (isStandable(isSolid, x, y - drop, z)) return y - drop
  }
  return null
}

const NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

// Returns the normalized horizontal direction toward the FIRST step of a
// walkable route from `entity` to `player`, or null when no route exists
// within the node budget (caller falls back to straight steering).
export const findDetourDirection = (
  entity: Position,
  player: Position,
  isSolid: SolidProbe,
  maxNodes: number = PATHFINDING_MAX_NODES,
): Vector3 | null => {
  const startX = Math.floor(entity.x)
  const startY = Math.floor(entity.y)
  const startZ = Math.floor(entity.z)
  const goalX = Math.floor(player.x)
  const goalZ = Math.floor(player.z)

  const open: Array<Node> = [
    { x: startX, y: startY, z: startZ, g: 0, f: heuristic(startX, startZ, goalX, goalZ), parent: null },
  ]
  const visited = new Set<string>([keyOf(startX, startY, startZ)])
  let expanded = 0

  while (open.length > 0 && expanded < maxNodes) {
    // Linear min-extract: the open list stays small under the node cap, so a
    // binary heap would cost more in constant factors than it saves.
    let bestIndex = 0
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIndex]!.f) bestIndex = i
    }
    const current = open.splice(bestIndex, 1)[0]!
    expanded++

    const dx = current.x + 0.5 - player.x
    const dz = current.z + 0.5 - player.z
    if (dx * dx + dz * dz <= GOAL_TOLERANCE_SQ) {
      // Walk back to the first step after the start.
      let node: Node = current
      while (node.parent !== null && node.parent.parent !== null) {
        node = node.parent
      }
      if (node.parent === null) return null // already at goal voxel
      const dirX = node.x + 0.5 - entity.x
      const dirZ = node.z + 0.5 - entity.z
      const len = Math.hypot(dirX, dirZ)
      if (len === 0) return null
      return { x: dirX / len, y: 0, z: dirZ / len }
    }

    for (const [ox, oz] of NEIGHBOR_OFFSETS) {
      const nx = current.x + ox
      const nz = current.z + oz
      const ny = resolveMoveY(isSolid, nx, current.y, nz)
      if (ny === null) continue
      const key = keyOf(nx, ny, nz)
      if (visited.has(key)) continue
      visited.add(key)
      const stepCost = ny === current.y ? 1 : ny > current.y ? 1.5 : 1.2
      const g = current.g + stepCost
      open.push({ x: nx, y: ny, z: nz, g, f: g + heuristic(nx, nz, goalX, goalZ), parent: current })
    }
  }

  return null
}
