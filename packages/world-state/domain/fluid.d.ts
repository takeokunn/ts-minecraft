import { Option } from 'effect';
export type FluidType = 'water' | 'lava';
export type FluidCell = Readonly<{
    readonly level: number;
    readonly source: boolean;
    readonly type: FluidType;
}>;
export declare const FLUID_BYTE_LENGTH: number;
export declare const createFluidBuffer: () => Uint8Array<ArrayBufferLike>;
export declare const encodeFluidCell: (cell: FluidCell) => number;
export declare const decodeFluidByte: (byte: number) => Option.Option<FluidCell>;
//# sourceMappingURL=fluid.d.ts.map