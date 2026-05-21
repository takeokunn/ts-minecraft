import { Array as Arr, Option } from 'effect';
export const splitBudget = (workWithCells, lavaTickActive, budget) => {
    const waterWork = Arr.filter(workWithCells, ({ cell }) => cell.type === 'water');
    const lavaWork = lavaTickActive
        ? Arr.filter(workWithCells, ({ cell }) => cell.type === 'lava')
        : [];
    const halfBudget = Math.floor(budget / 2);
    const waterSlice = Arr.take(waterWork, halfBudget);
    const lavaSlice = Arr.take(lavaWork, budget - waterSlice.length);
    const retainedLavaFrontier = lavaTickActive
        ? []
        : Arr.filterMap(workWithCells, ({ cell, key }) => cell.type === 'lava' ? Option.some(key) : Option.none());
    return {
        work: Arr.appendAll(waterSlice, lavaSlice),
        retainedLavaFrontier,
    };
};
//# sourceMappingURL=../../../dist/packages/terrain/application/fluid-tick-budget.js.map