import { Context, Data, Effect, Layer, Ref } from 'effect';
import { BlockType, blockTypes } from '../domain/block';
import { DestroyedBlock, PlacedBlock } from '../domain/components';

// --- Service State ---

export type Scene = 'Title' | 'InGame' | 'Paused';

export class GameStateData extends Data.Class<{
  readonly scene: Scene;
  readonly seeds: {
    readonly world: number;
    readonly biome: number;
    readonly trees: number;
  };
  readonly amplitude: number;
  readonly editedBlocks: {
    readonly placed: readonly PlacedBlock[];
    readonly destroyed: readonly DestroyedBlock[];
  };
  readonly hotbar: {
    readonly slots: readonly BlockType[];
    readonly selectedSlot: number; // 0-8
  };
  readonly shouldExit: boolean;
}> {}

// --- Service Interface ---

export interface GameState {
  readonly get: Effect.Effect<GameStateData>;
  readonly setScene: (scene: Scene) => Effect.Effect<void>;
  readonly setSeeds: (seeds: GameStateData['seeds']) => Effect.Effect<void>;
  readonly setAmplitude: (amplitude: number) => Effect.Effect<void>;
  readonly addPlacedBlock: (block: PlacedBlock) => Effect.Effect<void>;
  readonly addDestroyedBlock: (block: DestroyedBlock) => Effect.Effect<void>;
  readonly setSelectedSlot: (slot: number) => Effect.Effect<void>;
  readonly setShouldExit: (shouldExit: boolean) => Effect.Effect<void>;
}

export const GameState = Context.GenericTag<GameState>('GameState');

// --- Live Implementation ---

export const GameStateLive: Layer.Layer<GameState> = Layer.effect(
  GameState,
  Effect.gen(function* (_) {
    const hotbarSlots = Object.keys(blockTypes) as Array<BlockType>;

    const stateRef = yield* _(
      Ref.make<GameStateData>(
        new GameStateData({
          scene: 'Title',
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
        }),
      ),
    );

    

    return {
      get: Ref.get(stateRef),
      setScene: (scene) => Ref.update(stateRef, (s) => new GameStateData({ ...s, scene })),
      setSeeds: (seeds) => Ref.update(stateRef, (s) => new GameStateData({ ...s, seeds })),
      setAmplitude: (amplitude) =>
        Ref.update(stateRef, (s) => new GameStateData({ ...s, amplitude })),
      addPlacedBlock: (block) =>
        Ref.update(stateRef, (s) =>
          new GameStateData({
            ...s,
            editedBlocks: {
              ...s.editedBlocks,
              placed: [...s.editedBlocks.placed, block],
            },
          }),
        ),
      addDestroyedBlock: (block) =>
        Ref.update(stateRef, (s) =>
          new GameStateData({
            ...s,
            editedBlocks: {
              ...s.editedBlocks,
              destroyed: [...s.editedBlocks.destroyed, block],
            },
          }),
        ),
      setSelectedSlot: (slot) =>
        Ref.update(stateRef, (s) => {
          if (slot >= 0 && slot < s.hotbar.slots.length) {
            return new GameStateData({
              ...s,
              hotbar: { ...s.hotbar, selectedSlot: slot },
            });
          }
          return s;
        }),
      setShouldExit: (shouldExit) =>
        Ref.update(stateRef, (s) => new GameStateData({ ...s, shouldExit })),
    };
  }),
);