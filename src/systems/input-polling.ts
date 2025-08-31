import { Effect } from "effect";
import { InputState, Player } from "../domain/components";
import { Input } from "../runtime/services";
import { World, queryEntities, updateComponentData } from "../runtime/world";

export const inputPollingSystem: Effect.Effect<void, never, World | Input> =
  Effect.gen(function* (_) {
    const input = yield* _(Input);

    const players = yield* _(queryEntities({ all: [Player] }));
    if (players.length === 0) {
      return;
    }
    const playerId = players[0];

    const keyboardState = yield* _(input.getKeyboardState());

    yield* _(
      updateComponentData(
        playerId,
        { _tag: "InputState" },
        {
          forward: keyboardState.has("KeyW"),
          backward: keyboardState.has("KeyS"),
          left: keyboardState.has("KeyA"),
          right: keyboardState.has("KeyD"),
          jump: keyboardState.has("Space"),
          sprint: keyboardState.has("ShiftLeft"),
          destroy: keyboardState.has("Mouse0"),
          place: keyboardState.has("Mouse2"),
        },
      ),
    );
  }).pipe(Effect.withSpan("inputPollingSystem"));