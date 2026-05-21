import { Schema } from 'effect';
import { PlayerIdSchema, PositionSchema } from '@ts-minecraft/kernel';
import { Vector3Schema, QuaternionSchema } from '@ts-minecraft/kernel';
export const PlayerStateSchema = Schema.Struct({
    id: PlayerIdSchema,
    position: PositionSchema,
    velocity: Vector3Schema,
    rotation: QuaternionSchema,
});
//# sourceMappingURL=../../../dist/packages/player/domain/player-state.js.map