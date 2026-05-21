import { Effect, Option } from 'effect';
// Placeholder replaced by addShape during the body creation workflow.
const PLACEHOLDER_SHAPE = { kind: 'box', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } };
export class RigidBodyService extends Effect.Service()('@minecraft/infrastructure/physics/RigidBodyService', {
    succeed: {
        create: (config) => Effect.succeed({
            position: { x: config.position.x, y: config.position.y, z: config.position.z },
            velocity: { x: 0, y: 0, z: 0 },
            mass: config.mass,
            type: Option.getOrElse(Option.fromNullable(config.type), () => 'dynamic'),
            shape: PLACEHOLDER_SHAPE,
        }),
        setPosition: (body, position) => Effect.sync(() => {
            body.position.x = position.x;
            body.position.y = position.y;
            body.position.z = position.z;
        }),
        setVelocity: (body, velocity) => Effect.sync(() => {
            body.velocity.x = velocity.x;
            body.velocity.y = velocity.y;
            body.velocity.z = velocity.z;
        }),
        addShape: (body, shape) => Effect.sync(() => {
            body.shape = shape;
        }),
    },
}) {
}
export const RigidBodyServiceLive = RigidBodyService.Default;
//# sourceMappingURL=../../../../dist/packages/physics/infrastructure/boundary/rigid-body-service.js.map