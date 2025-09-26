/**
 * Hunger System Module Exports
 * 空腹度管理システムの公開API
 */

// Types
export * from './HungerTypes.js'

// Service Interface
export { HungerService } from './HungerService.js'
export type { HungerService as IHungerService } from './HungerService.js'

// Service Implementation
export { HungerServiceLive } from './HungerServiceLive.js'
