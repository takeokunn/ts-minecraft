import { Effect, HashMap, Option, Ref } from 'effect'
import { FLOW_OFFSETS, LAVA_INDEX, WATER_INDEX } from '@ts-minecraft/block/domain/fluid-model'
import { blockKey } from '@ts-minecraft/block/domain/fluid-position-utils'
import type { FluidCell, FluidState } from '@ts-minecraft/block/domain/fluid-model'
import type { Position } from '@ts-minecraft/core'
import { resolveNeighborContact } from './fluid-service-contact-ops'
import { setCellAndEnqueueKey } from './fluid-state-ops'
import { blockAt, canFluidReplaceAt, type LoadedChunkCache } from './fluid-service-helpers'
import type { FluidServiceWrites } from './fluid-service-write-ports'

export const tryFlowDownward = (
  writes: FluidServiceWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
  nextLevel: number,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const below = { x: position.x, y: position.y - 1, z: position.z }
    if (!canFluidReplaceAt(loaded, below, cell.type)) return false
    const targetKey = blockKey(below)
    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
      const existing = HashMap.get(s.cells, targetKey)
      /* c8 ignore next */
      const existingCell = Option.getOrNull(existing)
      if (existingCell !== null && existingCell.type === cell.type && existingCell.level <= nextLevel) return [false, s] as const
      const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
      return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
    })
    /* c8 ignore next */
    if (shouldWrite) yield* writes.writeFluid(loaded, below, { level: nextLevel, source: false, type: cell.type })
    return true
  })

export const tryRenewWaterSource = (
  writes: FluidServiceWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (cell.type !== 'water' || cell.source) return false
    const below = { x: position.x, y: position.y - 1, z: position.z }
    if (canFluidReplaceAt(loaded, below, 'water')) return false

    const state = yield* Ref.get(tickStateRef)
    let sourceNeighbors = 0
    for (let i = 0; i < FLOW_OFFSETS.length; i++) {
      const offset = FLOW_OFFSETS[i]!
      const neighbor = {
        x: position.x + offset.x,
        y: position.y,
        z: position.z + offset.z,
      }
      const neighborCell = HashMap.get(state.cells, blockKey(neighbor))
      const neighborValue = Option.getOrNull(neighborCell)
      if (neighborValue !== null && neighborValue.type === 'water' && neighborValue.source) {
        sourceNeighbors++
        if (sourceNeighbors >= 2) break
      }
    }
    if (sourceNeighbors < 2) return false

    const renewed: FluidCell = { level: 0, source: true, type: 'water' }
    yield* Ref.update(tickStateRef, (s) => setCellAndEnqueueKey(s, blockKey(position), renewed))
    yield* writes.writeFluid(loaded, position, renewed)
    return true
  })

export const flowLaterally = (
  writes: FluidServiceWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
  nextLevel: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (let i = 0; i < FLOW_OFFSETS.length; i++) {
      const offset = FLOW_OFFSETS[i]!
      const target = {
        x: position.x + offset.x,
        y: position.y + offset.y,
        z: position.z + offset.z,
      }
      if (!canFluidReplaceAt(loaded, target, cell.type)) {
        const otherIdx = blockAt(loaded, target)
        const otherIdxVal = Option.getOrNull(otherIdx)
        const isOpposite = otherIdxVal !== null &&
          /* c8 ignore next */
          (cell.type === 'lava' ? otherIdxVal === WATER_INDEX : otherIdxVal === LAVA_INDEX)
        /* c8 ignore next 3 */
        if (isOpposite) yield* resolveNeighborContact(writes, loaded, tickStateRef, position, cell)
        continue
      }
      const targetKey = blockKey(target)
      const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
        const existing = HashMap.get(s.cells, targetKey)
        /* c8 ignore next */
        const existingCell = Option.getOrNull(existing)
        if (existingCell !== null && existingCell.type === cell.type && existingCell.level <= nextLevel) return [false, s] as const
        const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
        return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
      })
      if (shouldWrite) yield* writes.writeFluid(loaded, target, { level: nextLevel, source: false, type: cell.type })
    }
  })
