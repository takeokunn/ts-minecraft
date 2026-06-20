import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { ColumnState } from './generator-types'
import { columnStateIndex } from './plant-placement-model'
import {
  placeCactusStack,
  placeGroundPlant,
  placeLilyPad,
  placeMushroom,
  placeSugarCaneStack,
} from './plant-placement-ops'
import {
  canPlaceCactusAt,
  canPlaceGroundPlantAt,
  canPlaceLilyPadAt,
  canPlaceMushroomAt,
  canPlaceSugarCaneAt,
  selectGroundPlantBlockIndex,
  selectMushroomBlockIndex,
  shouldPlaceCactus,
  shouldPlaceGroundPlant,
  shouldPlaceLilyPad,
  shouldPlaceMushroom,
  shouldPlaceSugarCane,
} from './plant-placement-rules'

export {
  shouldPlaceCactus,
  shouldPlaceGroundPlant,
  shouldPlaceLilyPad,
  shouldPlaceMushroom,
  shouldPlaceSugarCane,
}

export const placeChunkPlants = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  columnStates: ReadonlyArray<ColumnState>,
): void => {
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const state = columnStates[columnStateIndex(lx, lz)]
      if (!state) continue

      const wx = baseWorldX + lx
      const wz = baseWorldZ + lz
      if (
        shouldPlaceCactus(state.biome, state.surfaceY, wx, wz)
        && canPlaceCactusAt(blocks, lx, state.surfaceY, lz)
      ) {
        placeCactusStack(blocks, lx, state.surfaceY, lz, wx, wz)
        continue
      }

      if (
        shouldPlaceSugarCane(state.biome, state.surfaceY, wx, wz)
        && canPlaceSugarCaneAt(blocks, lx, state.surfaceY, lz)
      ) {
        placeSugarCaneStack(blocks, lx, state.surfaceY, lz, wx, wz)
        continue
      }

      if (
        shouldPlaceLilyPad(state.biome, state.surfaceY, wx, wz)
        && canPlaceLilyPadAt(blocks, lx, state.surfaceY, lz)
      ) {
        placeLilyPad(blocks, lx, state.surfaceY, lz)
        continue
      }

      if (
        shouldPlaceMushroom(state.biome, state.surfaceY, wx, wz)
        && canPlaceMushroomAt(blocks, lx, state.surfaceY, lz)
      ) {
        placeMushroom(
          blocks,
          lx,
          state.surfaceY,
          lz,
          selectMushroomBlockIndex(wx, wz),
        )
        continue
      }

      if (
        shouldPlaceGroundPlant(state.biome, state.surfaceY, wx, wz)
        && canPlaceGroundPlantAt(blocks, lx, state.surfaceY, lz)
      ) {
        placeGroundPlant(
          blocks,
          lx,
          state.surfaceY,
          lz,
          selectGroundPlantBlockIndex(state.biome, wx, wz),
        )
      }
    }
  }
}
