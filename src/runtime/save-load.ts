import { Effect } from 'effect';
import { saveAs } from 'file-saver';
import {
  CameraStateSchema as PlayerRotationSchema,
  PlayerSchema,
  PositionSchema,
  type SaveState,
} from '../domain/components';
import { GameState, type GameState as GameStateType } from './game-state';
import { query, type World } from './world';

/**
 * Collects the current game state and saves it to a JSON file.
 */
export const saveGame: Effect.Effect<void, never, GameState | World> =
  Effect.gen(function* (_) {
    const gameState: GameStateType = yield* _(GameState);

    const playerQuery = yield* _(
      query(PlayerSchema, PositionSchema, PlayerRotationSchema),
    );
    const player = playerQuery[0];

    if (!player) {
      return;
    }

    const position = player.get(PositionSchema);
    const rotation = player.get(PlayerRotationSchema);

    const currentState: SaveState = {
      seeds: gameState.seeds,
      amplitude: gameState.amplitude,
      cameraPosition: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      playerRotation: {
        x: rotation.pitch,
        y: rotation.yaw,
        z: 0, // z rotation is not used in CameraState
      },
      editedBlocks: gameState.editedBlocks,
    };

    const blob = new Blob([JSON.stringify(currentState, null, 2)], {
      type: 'application/json',
    });
    saveAs(blob, 'save.json');
  });

/**
 * Loads a game state and applies it to the world.
 * @param loadedData The parsed JSON object from the save file.
 */
export const loadGame = (
  loadedData: SaveState,
): Effect.Effect<void, never, GameState> =>
  Effect.gen(function* (_) {
    const gameState: GameStateType = yield* _(GameState);
    gameState.setSeeds(loadedData.seeds);
    gameState.setAmplitude(loadedData.amplitude);
    gameState.setEditedBlocks({
      placed: [...loadedData.editedBlocks.placed],
      destroyed: [...loaded.editedBlocks.destroyed],
    });
    // Player position will be handled separately after creation.
  });
