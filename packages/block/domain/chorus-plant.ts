import type { BlockType, Position } from '@ts-minecraft/core'

export const CHORUS_PLANT_MAX_HEIGHT = 5

export type ChorusWorldState = {
  readonly blockAt: (position: Position) => BlockType
}

export type ChorusGrowthBlock = {
  readonly pos: Position
  readonly blockType: 'CHORUS_FLOWER' | 'CHORUS_PLANT'
}

export type ChorusGrowthResult = {
  readonly newBlocks: ReadonlyArray<ChorusGrowthBlock>
}

const at = (position: Position, dx: number, dy: number, dz: number): Position => ({
  x: Math.floor(position.x) + dx,
  y: Math.floor(position.y) + dy,
  z: Math.floor(position.z) + dz,
})

const hashPosition = (position: Position, salt: number): number => {
  let hash = 2166136261 ^ salt
  hash = Math.imul(hash ^ Math.floor(position.x), 16777619)
  hash = Math.imul(hash ^ Math.floor(position.y), 16777619)
  hash = Math.imul(hash ^ Math.floor(position.z), 16777619)
  return hash >>> 0
}

const countPlantHeight = (position: Position, worldState: ChorusWorldState): number => {
  let height = 0
  for (let dy = 0; dy > -CHORUS_PLANT_MAX_HEIGHT; dy--) {
    const block = worldState.blockAt(at(position, 0, dy, 0))
    if (block !== 'CHORUS_PLANT' && block !== 'CHORUS_FLOWER') break
    height += 1
  }
  return height
}

export const canChorusFlowerGrow = (position: Position, worldState: ChorusWorldState): boolean => {
  const below = worldState.blockAt(at(position, 0, -1, 0))
  if (below !== 'CHORUS_PLANT' && below !== 'END_STONE') return false
  if (worldState.blockAt(at(position, 0, 1, 0)) !== 'AIR') return false
  return countPlantHeight(position, worldState) < CHORUS_PLANT_MAX_HEIGHT
}

export const growChorusPlant = (position: Position): ChorusGrowthResult => {
  const base = { x: Math.floor(position.x), y: Math.floor(position.y), z: Math.floor(position.z) }
  const height = 2 + (hashPosition(base, 11) % (CHORUS_PLANT_MAX_HEIGHT - 1))
  const newBlocks: ChorusGrowthBlock[] = []

  for (let step = 1; step <= height; step++) {
    const isTop = step === height
    newBlocks.push({
      pos: { x: base.x, y: base.y + step, z: base.z },
      blockType: isTop ? 'CHORUS_FLOWER' : 'CHORUS_PLANT',
    })

    if (!isTop && hashPosition(base, step) % 100 < 30) {
      const eastWest = hashPosition(base, step + 31) % 2 === 0
      const direction = hashPosition(base, step + 47) % 2 === 0 ? 1 : -1
      const branchPos = {
        x: base.x + (eastWest ? direction : 0),
        y: base.y + step,
        z: base.z + (eastWest ? 0 : direction),
      }
      newBlocks.push({ pos: branchPos, blockType: 'CHORUS_PLANT' })
      newBlocks.push({ pos: { ...branchPos, y: branchPos.y + 1 }, blockType: 'CHORUS_FLOWER' })
    }
  }

  return { newBlocks }
}
