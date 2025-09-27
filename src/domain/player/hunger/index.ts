/**
 * Hunger System Module Exports
 * 空腹度管理システムの公開API
 */

// Types
export * from './HungerTypes'

// Service Interface
export { HungerService } from './HungerService'
export type { HungerService as IHungerService } from './HungerService'

// Service Implementation
export { HungerServiceLive } from './HungerServiceLive'
