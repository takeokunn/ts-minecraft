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
  // Single classification pass instead of separate filter/filter/filterMap sweeps +
  // take/appendAll intermediates. Semantics are unchanged: water takes up to half the
  // budget, lava fills the remainder (only when its tick is active), and when lava's
  // tick is inactive its frontier keys are retained for the next tick.
  const water: WorkItem[] = []
  const lava: WorkItem[] = []
  for (let i = 0; i < workWithCells.length; i++) {
    const item = workWithCells[i]!
    if (item.cell.type === 'water') water.push(item)
    else if (item.cell.type === 'lava') lava.push(item)
  }

  const halfBudget = Math.floor(budget / 2)
  const waterSliceLen = Math.min(water.length, halfBudget)
  const lavaAvail = lavaTickActive ? lava.length : 0
  const lavaSliceLen = Math.min(lavaAvail, budget - waterSliceLen)

  const work: WorkItem[] = []
  for (let i = 0; i < waterSliceLen; i++) work.push(water[i]!)
  for (let i = 0; i < lavaSliceLen; i++) work.push(lava[i]!)

  const retainedLavaFrontier: FluidKey[] = []
  if (!lavaTickActive) {
    for (let i = 0; i < lava.length; i++) retainedLavaFrontier.push(lava[i]!.key)
  }

  return { work, retainedLavaFrontier }
}
