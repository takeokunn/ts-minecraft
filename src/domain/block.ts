import * as S from '@effect/schema/Schema';
import { match } from 'ts-pattern';

// --- Schemas ---
const Vector3IntSchema = S.Struct({
  x: S.Number.pipe(S.int()),
  y: S.Number.pipe(S.int()),
  z: S.Number.pipe(S.int()),
});

export const blockTypeNames = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'oakLeaves',
  'sand',
  'water',
  'glass',
  'brick',
  'plank',
] as const;

export const BlockType = S.Literal(...blockTypeNames);
export type BlockType = S.Schema.Type<typeof BlockType>;

export const PlacedBlockSchema = S.Struct({
  position: Vector3IntSchema,
  blockType: BlockType,
});
export type PlacedBlock = S.Schema.Type<typeof PlacedBlockSchema>;

export const BlockSchema = S.Struct({
  id: S.String,
  position: Vector3IntSchema,
  blockType: BlockType,
});
export type Block = S.Schema.Type<typeof BlockSchema>;

export const FaceNameSchema = S.Literal(
  'top',
  'bottom',
  'north',
  'south',
  'east',
  'west',
);
export type FaceName = S.Schema.Type<typeof FaceNameSchema>;

// --- Constants ---

export const hotbarSlots: ReadonlyArray<BlockType> = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'plank',
  'glass',
  'brick',
  'sand',
];

export const ATLAS_SIZE_IN_TILES = 16;
export const TILE_SIZE = 1 / ATLAS_SIZE_IN_TILES;

type BlockDefinition = {
  readonly textures: {
    readonly top?: readonly [number, number];
    readonly bottom?: readonly [number, number];
    readonly side: readonly [number, number];
  };
  readonly isTransparent: boolean;
  readonly isFluid: boolean;
};

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  grass: {
    textures: { top: [0, 0], bottom: [2, 0], side: [1, 0] },
    isTransparent: false,
    isFluid: false,
  },
  dirt: {
    textures: { side: [2, 0] },
    isTransparent: false,
    isFluid: false,
  },
  stone: {
    textures: { side: [3, 0] },
    isTransparent: false,
    isFluid: false,
  },
  cobblestone: {
    textures: { side: [4, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLog: {
    textures: { top: [6, 0], bottom: [6, 0], side: [5, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLeaves: {
    textures: { side: [7, 0] },
    isTransparent: true,
    isFluid: false,
  },
  sand: {
    textures: { side: [8, 0] },
    isTransparent: false,
    isFluid: false,
  },
  water: {
    textures: { side: [9, 0] },
    isTransparent: true,
    isFluid: true,
  },
  glass: {
    textures: { side: [10, 0] },
    isTransparent: true,
    isFluid: false,
  },
  brick: {
    textures: { side: [11, 0] },
    isTransparent: false,
    isFluid: false,
  },
  plank: {
    textures: { side: [12, 0] },
    isTransparent: false,
    isFluid: false,
  },
};

// --- Functions ---

import * as S from '@effect/schema/Schema';
import { match } from 'ts-pattern';
import { Vector3IntSchema } from './common';

// --- Schemas ---

export const blockTypeNames = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'oakLeaves',
  'sand',
  'water',
  'glass',
  'brick',
  'plank',
] as const;

export const BlockType = S.Literal(...blockTypeNames);
export type BlockType = S.Schema.Type<typeof BlockType>;

export const PlacedBlockSchema = S.Struct({
  position: Vector3IntSchema,
  blockType: BlockType,
});
export type PlacedBlock = S.Schema.Type<typeof PlacedBlockSchema>;

export const FaceNameSchema = S.Literal(
  'top',
  'bottom',
  'north',
  'south',
  'east',
  'west',
);
export type FaceName = S.Schema.Type<typeof FaceNameSchema>;

// --- Constants ---

export const hotbarSlots: ReadonlyArray<BlockType> = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'oakLog',
  'plank',
  'glass',
  'brick',
  'sand',
];

export const ATLAS_SIZE_IN_TILES = 16;
export const TILE_SIZE = 1 / ATLAS_SIZE_IN_TILES;

type BlockDefinition = {
  readonly textures: {
    readonly top?: readonly [number, number];
    readonly bottom?: readonly [number, number];
    readonly side: readonly [number, number];
  };
  readonly isTransparent: boolean;
  readonly isFluid: boolean;
};

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  grass: {
    textures: { top: [0, 0], bottom: [2, 0], side: [1, 0] },
    isTransparent: false,
    isFluid: false,
  },
  dirt: {
    textures: { side: [2, 0] },
    isTransparent: false,
    isFluid: false,
  },
  stone: {
    textures: { side: [3, 0] },
    isTransparent: false,
    isFluid: false,
  },
  cobblestone: {
    textures: { side: [4, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLog: {
    textures: { top: [6, 0], bottom: [6, 0], side: [5, 0] },
    isTransparent: false,
    isFluid: false,
  },
  oakLeaves: {
    textures: { side: [7, 0] },
    isTransparent: true,
    isFluid: false,
  },
  sand: {
    textures: { side: [8, 0] },
    isTransparent: false,
    isFluid: false,
  },
  water: {
    textures: { side: [9, 0] },
    isTransparent: true,
    isFluid: true,
  },
  glass: {
    textures: { side: [10, 0] },
    isTransparent: true,
    isFluid: false,
  },
  brick: {
    textures: { side: [11, 0] },
    isTransparent: false,
    isFluid: false,
  },
  plank: {
    textures: { side: [12, 0] },
    isTransparent: false,
    isFluid: false,
  },
};

// --- Functions ---

/**
 * Gets the UV coordinates for a specific face of a block type.
 * @param blockType The type of the block.
 * @param faceName The name of the face.
 * @returns A tuple [u, v] representing the texture coordinates.
 */
export const getUvForFace = (
  blockType: BlockType,
  faceName: FaceName,
): readonly [number, number] => {
  const textures = blockDefinitions[blockType].textures;

  return match(faceName)
    .with('top', () => textures.top ?? textures.side)
    .with('bottom', () => textures.bottom ?? textures.side)
    .otherwise(() => textures.side);
};

/**
 * Checks if a block type is transparent.
 * @param blockType The type of the block.
 * @returns True if the block is transparent, false otherwise.
 */
export const isBlockTransparent = (blockType: BlockType): boolean =>
  blockDefinitions[blockType].isTransparent;

/**
 * Checks if a block type is a fluid.
 * @param blockType The type of the block.
 * @returns True if the block is a fluid, false otherwise.
 */
export const isBlockFluid = (blockType: BlockType): boolean =>
  blockDefinitions[blockType].isFluid;

/**
 * Creates a PlacedBlock object.
 * @param position The position of the block.
 * @param blockType The type of the block.
 * @returns A PlacedBlock object.
 */
export const createPlacedBlock = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  blockType: BlockType,
): PlacedBlock => ({
  position,
  blockType,
});


export const isBlockTransparent = (blockType: BlockType): boolean =>
  blockDefinitions[blockType].isTransparent;

export const isBlockFluid = (blockType: BlockType): boolean =>
  blockDefinitions[blockType].isFluid;

export const createPlacedBlock = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  blockType: BlockType,
): PlacedBlock => ({
  position,
  blockType,
});