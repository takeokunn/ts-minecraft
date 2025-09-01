
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { UI } from '@/domain/types';

export const uiSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const ui = yield* _(UI);
  const players = world.queries.player(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];
  const hotbar = world.components.hotbar.get(player.entityId);

  if (hotbar) {
    ui.updateHotbar(hotbar);
  }
});
