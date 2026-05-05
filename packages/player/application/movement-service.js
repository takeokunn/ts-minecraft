import { Effect, Schema } from 'effect';
import { MetersPerSec } from '@ts-minecraft/kernel';
import { PlayerInputService } from './player-input-service';
import { KeyMappings } from '../domain/key-mappings';
export const MovementInputSchema = Schema.Struct({
    forward: Schema.Boolean,
    backward: Schema.Boolean,
    left: Schema.Boolean,
    right: Schema.Boolean,
    jump: Schema.Boolean,
    sprint: Schema.Boolean,
});
// Branded type enforces unit at compile time and validates finiteness at runtime.
export const DEFAULT_WALK_SPEED = MetersPerSec.make(8.0);
export const DEFAULT_SPRINT_SPEED = MetersPerSec.make(14.0);
export const DEFAULT_JUMP_VELOCITY = MetersPerSec.make(5.0);
// Pure math: no side effects — safe to call anywhere without Effect wrapping.
export const computeVelocity = (input, yaw, isGrounded) => {
    const speed = MetersPerSec.toNumber(input.sprint ? DEFAULT_SPRINT_SPEED : DEFAULT_WALK_SPEED);
    // Accumulate movement direction from all pressed keys.
    // Forward direction uses negative Z in most game engines.
    const rawX = (input.forward ? -Math.sin(yaw) : 0) +
        (input.backward ? Math.sin(yaw) : 0) +
        (input.left ? -Math.cos(yaw) : 0) +
        (input.right ? Math.cos(yaw) : 0);
    const rawZ = (input.forward ? -Math.cos(yaw) : 0) +
        (input.backward ? Math.cos(yaw) : 0) +
        (input.left ? Math.sin(yaw) : 0) +
        (input.right ? -Math.sin(yaw) : 0);
    // Normalize diagonal movement to prevent faster diagonal speeds.
    const length = Math.sqrt(rawX * rawX + rawZ * rawZ);
    const moveX = length > 0 ? (rawX / length) * speed : 0;
    const moveZ = length > 0 ? (rawZ / length) * speed : 0;
    // Y velocity is handled by physics (gravity/jump).
    const moveY = input.jump && isGrounded ? MetersPerSec.toNumber(DEFAULT_JUMP_VELOCITY) : 0;
    return { x: moveX, y: moveY, z: moveZ };
};
export class MovementService extends Effect.Service()('@minecraft/application/MovementService', {
    effect: Effect.map(PlayerInputService, (inputService) => {
        const getInput = () => Effect.gen(function* () {
            const [forward, backward, left, right, jump, sprint] = yield* Effect.all([
                inputService.isKeyPressed(KeyMappings.MOVE_FORWARD),
                inputService.isKeyPressed(KeyMappings.MOVE_BACKWARD),
                inputService.isKeyPressed(KeyMappings.MOVE_LEFT),
                inputService.isKeyPressed(KeyMappings.MOVE_RIGHT),
                // Use consumeKeyPress for jump to only trigger once per key press
                inputService.consumeKeyPress(KeyMappings.JUMP),
                inputService.isKeyPressed(KeyMappings.SPRINT),
            ], { concurrency: 'unbounded' });
            return { forward, backward, left, right, jump, sprint };
        });
        const calculateVelocity = (input, yaw, isGrounded) => Effect.succeed(computeVelocity(input, yaw, isGrounded));
        return {
            getInput,
            calculateVelocity,
            update: (yaw, isGrounded) => Effect.gen(function* () {
                const input = yield* getInput();
                return yield* calculateVelocity(input, yaw, isGrounded);
            }),
        };
    }),
}) {
}
export const MovementServiceLive = MovementService.Default;
//# sourceMappingURL=movement-service.js.map