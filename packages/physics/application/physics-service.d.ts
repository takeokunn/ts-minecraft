import { Effect, Schema } from 'effect';
import { PhysicsBodyId, Position, DeltaTimeSecs } from '@ts-minecraft/kernel';
import { type Vector3 } from '@ts-minecraft/kernel';
import { PhysicsWorldPort, RigidBodyPort, ShapePort } from '../domain/physics-port';
import type { WorldConfig } from '../domain/physics-world';
declare const PhysicsServiceError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "PhysicsServiceError";
} & Readonly<A>;
export declare class PhysicsServiceError extends PhysicsServiceError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
export declare const AddBodyConfigSchema: Schema.Struct<{
    mass: Schema.filter<Schema.filter<typeof Schema.Number>>;
    position: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    shape: Schema.Literal<["box", "sphere", "plane"]>;
    shapeParams: Schema.optional<Schema.Struct<{
        halfExtents: Schema.optional<Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            y: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>>;
        radius: Schema.optional<Schema.filter<Schema.filter<typeof Schema.Number>>>;
    }>>;
    type: Schema.optional<Schema.Literal<["dynamic", "static", "kinematic"]>>;
}>;
export type AddBodyConfig = Schema.Schema.Type<typeof AddBodyConfigSchema>;
declare const PhysicsService_base: Effect.Service.Class<PhysicsService, "@minecraft/application/PhysicsService", {
    readonly effect: Effect.Effect<{
        initialize: (config: WorldConfig) => Effect.Effect<void, PhysicsServiceError>;
        addBody: (config: AddBodyConfig) => Effect.Effect<PhysicsBodyId, PhysicsServiceError>;
        removeBody: (bodyId: PhysicsBodyId) => Effect.Effect<void, PhysicsServiceError>;
        step: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, PhysicsServiceError>;
        getVelocity: (bodyId: PhysicsBodyId) => Effect.Effect<Vector3, PhysicsServiceError>;
        getPosition: (bodyId: PhysicsBodyId) => Effect.Effect<Position, PhysicsServiceError>;
        setVelocity: (bodyId: PhysicsBodyId, velocity: Vector3) => Effect.Effect<void, PhysicsServiceError>;
        setPosition: (bodyId: PhysicsBodyId, position: Position) => Effect.Effect<void, PhysicsServiceError>;
    }, never, PhysicsWorldPort | RigidBodyPort | ShapePort>;
}>;
export declare class PhysicsService extends PhysicsService_base {
}
export declare const PhysicsServiceLive: import("effect/Layer").Layer<PhysicsService, never, PhysicsWorldPort | RigidBodyPort | ShapePort>;
export {};
//# sourceMappingURL=physics-service.d.ts.map