import { Effect } from 'effect';
import type { CustomBody, RigidBodyConfig, CustomShape } from '../../domain/physics-body';
import type { Vector3 } from '@ts-minecraft/kernel';
declare const RigidBodyService_base: Effect.Service.Class<RigidBodyService, "@minecraft/infrastructure/physics/RigidBodyService", {
    readonly succeed: {
        readonly create: (config: RigidBodyConfig) => Effect.Effect<CustomBody, never>;
        readonly setPosition: (body: CustomBody, position: Vector3) => Effect.Effect<void, never>;
        readonly setVelocity: (body: CustomBody, velocity: Vector3) => Effect.Effect<void, never>;
        readonly addShape: (body: CustomBody, shape: CustomShape) => Effect.Effect<void, never>;
    };
}>;
export declare class RigidBodyService extends RigidBodyService_base {
}
export declare const RigidBodyServiceLive: import("effect/Layer").Layer<RigidBodyService, never, never>;
export {};
//# sourceMappingURL=rigid-body-service.d.ts.map