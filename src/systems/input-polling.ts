import { Effect, Option } from "effect";
import { InputState, Player } from "../domain/components";
import { Input } from "../runtime/services";
import { World } from "../runtime/world";

export const inputPollingSystem: Effect.Effect<void, never, World | Input> =
  Effect.gen(function* (_) {
    const world = yield* _(World);
    const input = yield* _(Input);

    const playerOption = yield* _(world.querySingle(Player));
    if (Option.isNone(playerOption)) {
      return;
    }

    const [id] = playerOption.value;
    const keyboardState = yield* _(input.getKeyboardState());

    yield* _(
      world.updateComponent(
        id,
        new InputState({
          forward: keyboardState.has("KeyW"),
          backward: keyboardState.has("KeyS"),
          left: keyboardState.has("KeyA"),
          right: keyboardState.has("KeyD"),
          jump: keyboardState.has("Space"),
          sprint: keyboardState.has("ShiftLeft"),
          destroy: keyboardState.has("Mouse0"),
          place: keyboardState.has("Mouse2"),
        }),
      ),
    );
  }).pipe(Effect.withSpan("inputPollingSystem"));
