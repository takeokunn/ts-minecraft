import { Effect, Layer } from 'effect';
import { PhysicsWorldPort, RigidBodyPort, ShapePort } from '../domain/physics-port';
import { PhysicsWorldService, PhysicsWorldServiceLive } from './boundary/physics-world-service';
import { RigidBodyService, RigidBodyServiceLive } from './boundary/rigid-body-service';
import { ShapeService, ShapeServiceLive } from './boundary/shape-service';
export const PhysicsWorldPortLayer = Layer.effect(PhysicsWorldPort, Effect.map(PhysicsWorldService, (svc) => ({
    create: (config) => svc.create(config),
    addBody: (world, body) => svc.addBody(world, body),
    removeBody: (world, body) => svc.removeBody(world, body),
    step: (world, dt) => svc.step(world, dt),
}))).pipe(Layer.provide(PhysicsWorldServiceLive));
export const RigidBodyPortLayer = Layer.effect(RigidBodyPort, Effect.map(RigidBodyService, (svc) => ({
    create: (config) => svc.create(config),
    setPosition: (body, position) => svc.setPosition(body, position),
    setVelocity: (body, velocity) => svc.setVelocity(body, velocity),
    addShape: (body, shape) => svc.addShape(body, shape),
}))).pipe(Layer.provide(RigidBodyServiceLive));
export const ShapePortLayer = Layer.effect(ShapePort, Effect.map(ShapeService, (svc) => ({
    createBox: (config) => svc.createBox(config),
    createSphere: (config) => svc.createSphere(config),
    createPlane: () => svc.createPlane(),
}))).pipe(Layer.provide(ShapeServiceLive));
//# sourceMappingURL=port-layers.js.map