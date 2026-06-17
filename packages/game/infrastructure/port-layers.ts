import { Effect, Layer } from 'effect'
import { PhysicsWorldPort, RigidBodyPort, ShapePort } from '../domain/physics-port'
import { PhysicsWorldService } from './boundary/physics-world-service'
import { RigidBodyService } from './boundary/rigid-body-service'
import { ShapeService } from './boundary/shape-service'

export const PhysicsWorldPortLayer = Layer.effect(
  PhysicsWorldPort,
  Effect.map(PhysicsWorldService, (svc): PhysicsWorldPort => ({
    create: (config) => svc.create(config),
    addBody: (world, body) => svc.addBody(world, body),
    removeBody: (world, body) => svc.removeBody(world, body),
    step: (world, dt) => svc.step(world, dt),
  }))
).pipe(Layer.provide(PhysicsWorldService.Default))

export const RigidBodyPortLayer = Layer.effect(
  RigidBodyPort,
  Effect.map(RigidBodyService, (svc): RigidBodyPort => ({
    create: (config) => svc.create(config),
    setPosition: (body, position) => svc.setPosition(body, position),
    setVelocity: (body, velocity) => svc.setVelocity(body, velocity),
    addShape: (body, shape) => svc.addShape(body, shape),
  }))
).pipe(Layer.provide(RigidBodyService.Default))

export const ShapePortLayer = Layer.effect(
  ShapePort,
  Effect.map(ShapeService, (svc): ShapePort => ({
    createBox: (config) => svc.createBox(config),
    createSphere: (config) => svc.createSphere(config),
    createPlane: () => svc.createPlane(),
  }))
).pipe(Layer.provide(ShapeService.Default))
