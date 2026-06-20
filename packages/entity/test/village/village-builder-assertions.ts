import { expect } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import type { BlockPlacement } from '@ts-minecraft/entity/domain/village/village-builder-grid'

type PlacementPosition = Pick<Position, 'x' | 'y' | 'z'>

export const placementsOfType = (
  placements: ReadonlyArray<BlockPlacement>,
  blockType: BlockPlacement['blockType'],
): ReadonlyArray<BlockPlacement> => placements.filter(placement => placement.blockType === blockType)

export const expectBlockTypes = (
  placements: ReadonlyArray<BlockPlacement>,
  expectedBlockTypes: ReadonlyArray<BlockPlacement['blockType']>,
): void => {
  expect(new Set(placements.map(placement => placement.blockType))).toEqual(new Set(expectedBlockTypes))
}

export const expectPlacementCount = (
  placements: ReadonlyArray<BlockPlacement>,
  blockType: BlockPlacement['blockType'],
  expectedCount: number,
): void => {
  expect(placementsOfType(placements, blockType)).toHaveLength(expectedCount)
}

export const expectAllPlacementsToMatch = (
  placements: ReadonlyArray<BlockPlacement>,
  predicate: (placement: BlockPlacement) => boolean,
): void => {
  expect(placements.every(predicate)).toBe(true)
}

export const expectPlacementAt = (
  placements: ReadonlyArray<BlockPlacement>,
  blockType: BlockPlacement['blockType'],
  position: PlacementPosition,
): void => {
  expect(
    placements.find(placement =>
      placement.blockType === blockType &&
      placement.position.x === position.x &&
      placement.position.y === position.y &&
      placement.position.z === position.z,
    ),
  ).toBeDefined()
}

export const expectNoPlacementAt = (
  placements: ReadonlyArray<BlockPlacement>,
  blockType: BlockPlacement['blockType'],
  position: PlacementPosition,
): void => {
  expect(
    placements.find(placement =>
      placement.blockType === blockType &&
      placement.position.x === position.x &&
      placement.position.y === position.y &&
      placement.position.z === position.z,
    ),
  ).toBeUndefined()
}
