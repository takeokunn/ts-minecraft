import { Hotbar } from '@/domain/components';
import { playerQuery } from '@/domain/queries';
import { System } from '@/runtime/loop';
import { query, World } from '@/runtime/world';

export type HotbarUpdater = (hotbar: Hotbar) => void;

// A default no-op updater if none is provided.
const noOpUpdater: HotbarUpdater = () => {};

/**
 * Creates a UI system with a specific dependency (the hotbar updater).
 * This pattern is used to inject UI-specific logic without polluting the main game loop dependencies.
 * @param updateHotbar A function that takes the player's hotbar state and updates the UI.
 * @returns A system function compatible with the game loop.
 */
export const createUISystem = (updateHotbar: HotbarUpdater = noOpUpdater): System => {
  return (world: World) => {
    // Assuming a single player for now
    const player = query(world, playerQuery)[0];

    if (player?.hotbar) {
      updateHotbar(player.hotbar);
    }

    // This system only reads from the world, so it returns the world unchanged.
    return [world, []];
  };
};