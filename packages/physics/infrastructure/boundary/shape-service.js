import { Effect } from 'effect';
export class ShapeService extends Effect.Service()('@minecraft/infrastructure/physics/ShapeService', {
    succeed: {
        createBox: (config) => Effect.succeed({ kind: 'box', halfExtents: config.halfExtents }),
        createSphere: (config) => Effect.succeed({ kind: 'sphere', radius: config.radius }),
        createPlane: () => Effect.succeed({ kind: 'plane' }),
    },
}) {
}
export const ShapeServiceLive = ShapeService.Default;
//# sourceMappingURL=../../../../dist/packages/physics/infrastructure/boundary/shape-service.js.map