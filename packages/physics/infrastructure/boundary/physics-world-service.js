import { Effect } from 'effect';
export class PhysicsWorldService extends Effect.Service()('@minecraft/infrastructure/physics/PhysicsWorldService', {
    succeed: {
        create: (config) => Effect.succeed({
            gravity: { x: config.gravity.x, y: config.gravity.y, z: config.gravity.z },
            bodies: [],
        }),
        addBody: (world, body) => Effect.sync(() => {
            world.bodies.push(body);
        }),
        removeBody: (world, body) => Effect.sync(() => {
            for (let index = world.bodies.length - 1; index >= 0; index -= 1) {
                if (world.bodies[index] === body) {
                    world.bodies.splice(index, 1);
                }
            }
        }),
        step: (world, deltaTime) => Effect.sync(() => {
            const gravityY = world.gravity.y;
            for (const body of world.bodies) {
                if (body.type !== 'dynamic')
                    continue;
                body.velocity.y += gravityY * deltaTime;
                body.position.x += body.velocity.x * deltaTime;
                body.position.y += body.velocity.y * deltaTime;
                body.position.z += body.velocity.z * deltaTime;
            }
        }),
    },
}) {
}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default;
//# sourceMappingURL=../../../../dist/packages/physics/infrastructure/boundary/physics-world-service.js.map