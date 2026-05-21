import { Effect, Option } from 'effect';
import { setBlockInChunk } from '../domain/chunk';
import { createFluidBuffer, encodeFluidCell, FLUID_BYTE_LENGTH, blockTypeFor, getBlockIndex, localX, localY, localZ, } from '@ts-minecraft/world-state';
export const ensureFluidBuffer = (chunk) => Option.match(Option.filter(chunk.fluid, (b) => b.byteLength === FLUID_BYTE_LENGTH), {
    onNone: () => Effect.sync(() => {
        const fluid = createFluidBuffer();
        chunk.fluid = Option.some(fluid);
        return fluid;
    }),
    onSome: Effect.succeed,
});
export const setFluidBlockIfLoaded = (chunkOpt, position, cell, chunkManagerService) => Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
        yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockTypeFor(cell.type)));
        const fluid = yield* ensureFluidBuffer(chunk);
        const idx = getBlockIndex(position);
        if (idx >= 0) {
            fluid[idx] = encodeFluidCell(cell);
        }
        yield* chunkManagerService.markChunkDirty(chunk.coord);
    }),
});
export const setAirBlockIfLoaded = (chunkOpt, position, chunkManagerService) => Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
        yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'AIR'));
        const fluid = yield* ensureFluidBuffer(chunk);
        const idx = getBlockIndex(position);
        if (idx >= 0) {
            fluid[idx] = 0;
        }
        yield* chunkManagerService.markChunkDirty(chunk.coord);
    }),
});
export const setSolidBlockIfLoaded = (chunkOpt, position, blockType, chunkManagerService) => Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
        yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockType));
        const fluid = yield* ensureFluidBuffer(chunk);
        const idx = getBlockIndex(position);
        /* c8 ignore next */
        if (idx >= 0) {
            fluid[idx] = 0;
        }
        yield* chunkManagerService.markChunkDirty(chunk.coord);
    }),
});
//# sourceMappingURL=../../../dist/packages/terrain/application/fluid-chunk-ops.js.map