import { Effect } from "effect";
import { Hotbar, Player } from "../domain/components";
import { World, getComponentStore, queryEntities } from "@/runtime/world";
import { BlockType, blockTypeNames } from "@/domain/block";

/**
 * Runs every frame to update UI elements like the hotbar.
 */
export const uiSystem: Effect.Effect<void, never, World> = Effect.gen(
  function* (_) {
    const players = yield* _(queryEntities({ all: [Player, Hotbar] }));
    if (players.length === 0) {
      return;
    }
    const playerId = players[0];

    const hotbars = yield* _(getComponentStore(Hotbar));
    const selectedSlot = hotbars.selectedSlot[playerId];

    for (let i = 0; i < 9; i++) {
      const slotElement: HTMLElement | null = document.getElementById(
        `slot${i + 1}`,
      );
      if (slotElement) {
        slotElement.innerHTML = "";
        slotElement.style.backgroundImage = "";

        const blockTypeIndex = hotbars[`slot${i}` as keyof typeof hotbars][playerId] as number;
        const blockType: BlockType | undefined = blockTypeNames[blockTypeIndex];

        if (blockType) {
          const textureUrl = `/assets/${blockType}/side.jpeg`;
          slotElement.style.backgroundImage = `url(${textureUrl})`;
          slotElement.style.backgroundSize = "cover";
        }

        if (i === selectedSlot) {
          slotElement.classList.add("selected");
        } else {
          slotElement.classList.remove("selected");
        }
      }
    }
  },
).pipe(Effect.withSpan("uiSystem"));