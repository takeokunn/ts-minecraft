import { Context, Layer, Ref, type Tag } from 'effect';
import type { DestroyedBlock, PlacedBlock } from '../domain/components';

export const blockTypes = {
  grass: null,
  dirt: null,
  stone: null,
  cobblestone: null,
  oakLog: null,
  oakLeaves: null,
  sand: null,
  water: null,
  glass: null,
  brick: null,
  plank: null,
} as const;

export const hotbarSlots: Array<keyof typeof blockTypes> = Object.keys(
  blockTypes,
) as Array<keyof typeof blockTypes>;
export type BlockType = keyof typeof blockTypes;

export type Chunk = Set<string>; // Set of "x,y,z" strings for blocks in the chunk
export type ChunkMap = Map<string, Chunk>; // Map of "chunkX,chunkZ" to Chunk

export type Scene = 'Title' | 'InGame' | 'Paused';

export interface GameState {
  readonly scene: Ref.Ref<Scene>;
  seeds: {
    world: number;
    biome: number;
    trees: number;
  };
  amplitude: number;
  editedBlocks: {
    placed: PlacedBlock[];
    destroyed: DestroyedBlock[];
  };
  hotbar: {
    slots: readonly BlockType[];
    selectedSlot: number; // 0-8
  };
  readonly world: {
    chunkMap: ChunkMap;
  };
  setSeeds: (seeds: GameState['seeds']) => void;
  setAmplitude: (amplitude: number) => void;
  setEditedBlocks: (blocks: GameState['editedBlocks']) => void;
  addPlacedBlock: (block: PlacedBlock) => void;
  addDestroyedBlock: (block: DestroyedBlock) => void;
  setSelectedSlot: (slot: number) => void;
  shouldExit: boolean;
  setShouldExit: (shouldExit: boolean) => void;
}

import { Context, Layer, Ref } from 'effect';
import type { DestroyedBlock, PlacedBlock } from '../domain/components';

export const blockTypes = {
  grass: null,
  dirt: null,
  stone: null,
  cobblestone: null,
  oakLog: null,
  oakLeaves: null,
  sand: null,
  water: null,
  glass: null,
  brick: null,
  plank: null,
} as const;

export const hotbarSlots: Array<keyof typeof blockTypes> = Object.keys(
  blockTypes,
) as Array<keyof typeof blockTypes>;
export type BlockType = keyof typeof blockTypes;

export type Chunk = Set<string>; // Set of "x,y,z" strings for blocks in the chunk
export type ChunkMap = Map<string, Chunk>; // Map of "chunkX,chunkZ" to Chunk

export type Scene = 'Title' | 'InGame' | 'Paused';

export interface GameState {
  readonly scene: Ref.Ref<Scene>;
  seeds: {
    world: number;
    biome: number;
    trees: number;
  };
  amplitude: number;
  editedBlocks: {
    placed: PlacedBlock[];
    destroyed: DestroyedBlock[];
  };
  hotbar: {
    slots: readonly BlockType[];
    selectedSlot: number; // 0-8
  };
  readonly world: {
    chunkMap: ChunkMap;
  };
  setSeeds: (seeds: GameState['seeds']) => void;
  setAmplitude: (amplitude: number) => void;
  setEditedBlocks: (blocks: GameState['editedBlocks']) => void;
  addPlacedBlock: (block: PlacedBlock) => void;
  addDestroyedBlock: (block: DestroyedBlock) => void;
  setSelectedSlot: (slot: number) => void;
  shouldExit: boolean;
  setShouldExit: (shouldExit: boolean) => void;
}

export const GameState = Context.Tag<GameState>('GameState');

export const GameStateLive: Layer.Layer<GameState> = Layer.sync(
  GameState,
  (): GameState => {
    const state: GameState = {
      scene: Ref.unsafeMake<Scene>('Title'),
      seeds: {
        world: Math.random(),
        biome: Math.random(),
        trees: Math.random(),
      },
      amplitude: 30 + Math.random() * 70,
      editedBlocks: {
        placed: [],
        destroyed: [],
      },
      hotbar: {
        slots: hotbarSlots,
        selectedSlot: 0,
      },
      shouldExit: false,
      world: {
        chunkMap: new Map(),
      },
      setSeeds(seeds: GameState['seeds']): void {
        state.seeds = seeds;
      },
      setAmplitude(amplitude: number): void {
        state.amplitude = amplitude;
      },
      setEditedBlocks(blocks: GameState['editedBlocks']): void {
        state.editedBlocks = blocks;
      },
      addPlacedBlock(block: PlacedBlock): void {
        state.editedBlocks.placed.push(block);
      },
      addDestroyedBlock(block: DestroyedBlock): void {
        state.editedBlocks.destroyed.push(block);
      },
      setSelectedSlot(slot: number): void {
        if (slot >= 0 && slot < state.hotbar.slots.length) {
          state.hotbar.selectedSlot = slot;
        }
      },
      setShouldExit(shouldExit: boolean): void {
        state.shouldExit = shouldExit;
      },
    };
    return state;
  },
);


export const GameStateLive: Layer.Layer<GameState> = Layer.sync(
  GameState,
  (): GameState => {
    const state: GameState = {
      scene: Ref.unsafeMake<Scene>('Title'),
      seeds: {
        world: Math.random(),
        biome: Math.random(),
        trees: Math.random(),
      },
      amplitude: 30 + Math.random() * 70,
      editedBlocks: {
        placed: [],
        destroyed: [],
      },
      hotbar: {
        slots: hotbarSlots,
        selectedSlot: 0,
      },
      shouldExit: false,
      world: {
        chunkMap: new Map(),
      },
      setSeeds(seeds: GameState['seeds']): void {
        state.seeds = seeds;
      },
      setAmplitude(amplitude: number): void {
        state.amplitude = amplitude;
      },
      setEditedBlocks(blocks: GameState['editedBlocks']): void {
        state.editedBlocks = blocks;
      },
      addPlacedBlock(block: PlacedBlock): void {
        state.editedBlocks.placed.push(block);
      },
      addDestroyedBlock(block: DestroyedBlock): void {
        state.editedBlocks.destroyed.push(block);
      },
      setSelectedSlot(slot: number): void {
        if (slot >= 0 && slot < state.hotbar.slots.length) {
          state.hotbar.selectedSlot = slot;
        }
      },
      setShouldExit(shouldExit: boolean): void {
        state.shouldExit = shouldExit;
      },
    };
    return state;
  },
);