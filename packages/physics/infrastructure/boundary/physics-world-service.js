import { Array as Arr, Effect } from 'effect';
export class PhysicsWorldService extends Effect.Service()('@minecraft/infrastructure/physics/PhysicsWorldService', {
    succeed: {
        create: (config) => Effect.succeed({
            gravity: { x: config.gravity.x, y: config.gravity.y, z: config.gravity.z },
            bodies: [],
        }),
        addBody: (world, body) => Effect.sync(() => {
            world.bodies = Arr.append(world.bodies, body);
        }),
        removeBody: (world, body) => Effect.sync(() => {
            world.bodies = Arr.filter(world.bodies, (b) => b !== body);
        }),
        step: (world, deltaTime) => Effect.sync(() => {
            Arr.forEach(world.bodies, (body) => {
                if (body.type !== 'dynamic')
                    return;
                // Euler integration with gravity
                body.velocity.y += world.gravity.y * deltaTime;
                body.position.x += body.velocity.x * deltaTime;
                body.position.y += body.velocity.y * deltaTime;
                body.position.z += body.velocity.z * deltaTime;
            });
        }),
    },
}) {
}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default;
//# sourceMappingURL=physics-world-service.js.map