import { Context } from 'effect'

// Placeholder service tags for Effect-TS layer composition
// These will be implemented with actual services in future phases

export const RendererService = Context.GenericTag<unknown>('@minecraft/RendererService')
export const SceneService = Context.GenericTag<unknown>('@minecraft/SceneService')
export const PerspectiveCameraService = Context.GenericTag<unknown>('@minecraft/PerspectiveCameraService')
export const PhysicsWorldService = Context.GenericTag<unknown>('@minecraft/PhysicsWorldService')
export const RigidBodyService = Context.GenericTag<unknown>('@minecraft/RigidBodyService')
