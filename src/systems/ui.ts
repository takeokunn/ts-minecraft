import { Effect } from 'effect';
import { GameState } from '../runtime/game-state';
import { BlockType } from '../domain/block';

/**
 * Runs every frame to update UI elements like the hotbar.
 */
export const uiSystem: Effect.Effect<void, never, GameState> = Effect.gen(
  function* (_) {
    const gameStateService = yield* _(GameState);
    const gameState = yield* _(gameStateService.get);
    const { selectedSlot, slots } = gameState.hotbar;

    for (let i = 0; i < 9; i++) {
      const slotElement: HTMLElement | null = document.getElementById(
        `slot${i + 1}`,
      );
      if (slotElement) {
        // Clear previous content
        slotElement.innerHTML = '';
        slotElement.style.backgroundImage = '';

        const blockType: BlockType | undefined = slots[i];
        if (blockType) {
          // Display block texture in hotbar.
          // NOTE: This assumes a consistent file structure and naming convention for assets.
          // Not all blocks might have a side.jpeg. This could be improved.
          const textureUrl = `/assets/${blockType}/side.jpeg`;
          slotElement.style.backgroundImage = `url(${textureUrl})`;
          slotElement.style.backgroundSize = 'cover';
        }

        if (i === selectedSlot) {
          slotElement.classList.add('selected');
        } else {
          slotElement.classList.remove('selected');
        }
      }
    }
  },
).pipe(Effect.withSpan('uiSystem'));
