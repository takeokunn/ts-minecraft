
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { Input } from '@/domain/types';
import { InputState } from '@/domain/components';

export const keyMap = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  destroy: 'Mouse0',
  place: 'Mouse2',
} as const;

export const mapInputToState = (
  keyboardState: Set<string>,
): InputState => ({
  forward: keyboardState.has(keyMap.forward),
  backward: keyboardState.has(keyMap.backward),
  left: keyboardState.has(keyMap.left),
  right: keyboardState.has(keyMap.right),
  jump: keyboardState.has(keyMap.jump),
  sprint: keyboardState.has(keyMap.sprint),
  destroy: keyboardState.has(keyMap.destroy),
  place: keyboardState.has(keyMap.place),
});

export const inputPollingSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const input = yield* _(Input);
  const players = world.queries.player(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];

  const keyboardState = input.getKeyboardState();
  const newInputState = mapInputToState(keyboardState);

  world.components.inputState.set(player.entityId, newInputState);
});
