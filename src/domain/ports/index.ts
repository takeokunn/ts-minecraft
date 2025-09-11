/**
 * Domain Ports - Port interfaces for dependency inversion
 *
 * These ports define the contracts for external dependencies,
 * allowing the domain layer to remain independent of specific
 * implementations while maintaining clean architecture principles.
 */

export * from './world.repository'
export * from './spatial-grid.port'
export * from './input.port'
export * from './clock.port'
export * from './raycast.port'
export * from './render.port'
