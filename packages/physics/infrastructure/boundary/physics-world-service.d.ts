import { Effect } from 'effect';
import type { CustomBody } from '../../domain/physics-body';
import type { CustomWorld, WorldConfig } from '../../domain/physics-world';
import type { DeltaTimeSecs } from '@ts-minecraft/kernel';
declare const PhysicsWorldService_base: Effect.Service.Class<PhysicsWorldService, "@minecraft/infrastructure/physics/PhysicsWorldService", {
    readonly succeed: {
        readonly create: (config: WorldConfig) => Effect.Effect<CustomWorld, never>;
        readonly addBody: (world: CustomWorld, body: CustomBody) => Effect.Effect<void, never>;
        readonly removeBody: (world: CustomWorld, body: CustomBody) => Effect.Effect<void, never>;
        readonly step: (world: CustomWorld, deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>;
    };
}>;
export declare class PhysicsWorldService extends PhysicsWorldService_base {
}
export declare const PhysicsWorldServiceLive: import("effect/Layer").Layer<PhysicsWorldService, never, never>;
export {};
//# sourceMappingURL=physics-world-service.d.ts.map