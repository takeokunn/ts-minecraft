import { Brand, HashMap, HashSet } from 'effect';
import type { FluidCell } from './fluid';
export declare const AIR_INDEX: number;
export declare const WATER_INDEX: number;
export declare const LAVA_INDEX: number;
export declare const WATER_MAX_LEVEL = 7;
export declare const LAVA_MAX_LEVEL = 3;
export declare const FLUID_TICK_BUDGET = 512;
export declare const LAVA_TICK_INTERVAL = 3;
export declare const FLOW_OFFSETS: readonly [{
    readonly x: 1;
    readonly y: 0;
    readonly z: 0;
}, {
    readonly x: -1;
    readonly y: 0;
    readonly z: 0;
}, {
    readonly x: 0;
    readonly y: 0;
    readonly z: 1;
}, {
    readonly x: 0;
    readonly y: 0;
    readonly z: -1;
}];
export declare const NOTIFY_OFFSETS: readonly [{
    readonly x: 0;
    readonly y: 1;
    readonly z: 0;
}, {
    readonly x: 0;
    readonly y: -1;
    readonly z: 0;
}, {
    readonly x: 1;
    readonly y: 0;
    readonly z: 0;
}, {
    readonly x: -1;
    readonly y: 0;
    readonly z: 0;
}, {
    readonly x: 0;
    readonly y: 0;
    readonly z: 1;
}, {
    readonly x: 0;
    readonly y: 0;
    readonly z: -1;
}];
export type FluidKey = number & Brand.Brand<'FluidKey'>;
export declare const FluidKey: Brand.Brand.Constructor<FluidKey>;
export type FluidState = Readonly<{
    readonly cells: HashMap.HashMap<FluidKey, FluidCell>;
    readonly frontier: HashSet.HashSet<FluidKey>;
    readonly tickCounter: number;
}>;
export declare const INITIAL_STATE: FluidState;
export declare const BIAS = 32768;
export declare const Y_STRIDE = 65536;
export declare const XZ_STRIDE: number;
//# sourceMappingURL=fluid-model.d.ts.map