import { BlockType } from '@ts-minecraft/kernel';
export declare const LIGHT_LEVEL_MAX = 15;
export declare const LIGHT_LEVEL_MIN = 0;
export declare const LIGHT_BYTE_LENGTH: number;
export type LightGrids = Readonly<{
    readonly skyLight: Uint8Array;
    readonly blockLight: Uint8Array;
}>;
export declare const isTransparent: (blockType: BlockType) => boolean;
export declare const emissiveLightLevel: (blockType: BlockType) => number;
export declare const isTransparentIndex: (blockIdx: number) => boolean;
export declare const emissiveLevelByIndex: (blockIdx: number) => number;
export declare const createLightBuffer: () => Uint8Array<ArrayBufferLike>;
export declare const getLightAt: (grid: Uint8Array, lx: number, y: number, lz: number) => number;
export declare const setLightAt: (grid: Uint8Array, lx: number, y: number, lz: number, value: number) => void;
export declare const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]>;
export declare const computeBlockLight: (blocks: Uint8Array, lightGrid: Uint8Array) => void;
export declare const computeSkyLight: (blocks: Uint8Array, lightGrid: Uint8Array) => void;
//# sourceMappingURL=light.d.ts.map