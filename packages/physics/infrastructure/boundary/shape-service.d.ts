import { Effect } from 'effect';
import type { CustomShape } from '../../domain/physics-body';
import type { BoxShapeConfig, SphereShapeConfig } from '../../domain/physics-shape';
declare const ShapeService_base: Effect.Service.Class<ShapeService, "@minecraft/infrastructure/physics/ShapeService", {
    readonly succeed: {
        readonly createBox: (config: BoxShapeConfig) => Effect.Effect<CustomShape, never>;
        readonly createSphere: (config: SphereShapeConfig) => Effect.Effect<CustomShape, never>;
        readonly createPlane: () => Effect.Effect<CustomShape, never>;
    };
}>;
export declare class ShapeService extends ShapeService_base {
}
export declare const ShapeServiceLive: import("effect/Layer").Layer<ShapeService, never, never>;
export {};
//# sourceMappingURL=shape-service.d.ts.map