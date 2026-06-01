import { Array as Arr, Option } from 'effect'
import type { FluidCell, FluidKey } from '@ts-minecraft/block'

export type WorkItem = { key: FluidKey; cell: FluidCell }

export const splitBudget = (
  workWithCells: ReadonlyArray<WorkItem>,
  lavaTickActive: boolean,
  budget: number,
): {
  work: ReadonlyArray<WorkItem>
  retainedLavaFrontier: ReadonlyArray<FluidKey>
} => {
  const waterWork = Arr.filter(workWithCells, ({ cell }) => cell.type === 'water')
  const lavaWork = lavaTickActive
    ? Arr.filter(workWithCells, ({ cell }) => cell.type === 'lava')
    : []
  const halfBudget = Math.floor(budget / 2)
  const waterSlice = Arr.take(waterWork, halfBudget)
  const lavaSlice = Arr.take(lavaWork, budget - waterSlice.length)
  const retainedLavaFrontier = lavaTickActive
    ? []
    : Arr.filterMap(workWithCells, ({ cell, key }) => cell.type === 'lava' ? Option.some(key) : Option.none())
  return {
    work: Arr.appendAll(waterSlice, lavaSlice),
    retainedLavaFrontier,
  }
}
