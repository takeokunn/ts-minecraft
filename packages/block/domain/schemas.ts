// World-state domain schemas — consolidated re-exports
export {
  BlockPropertiesSchema,
  BlockFaceSchema,
  Block,
} from './block'
export type { BlockProperties, BlockFace } from './block'

// Fluid bit-flag constants and encode/decode helpers
export {
  FLUID_BYTE_LENGTH,
  createFluidBuffer,
  encodeFluidCell,
  decodeFluidByte,
} from './fluid'
export type { FluidCell, FluidType } from './fluid'

// Light grid constants
export { LIGHT_LEVEL_MAX, LIGHT_LEVEL_MIN, LIGHT_BYTE_LENGTH } from './light'
export type { LightGrids } from './light'

// Fluid model constants
export {
  AIR_INDEX,
  WATER_INDEX,
  LAVA_INDEX,
  WATER_MAX_LEVEL,
  LAVA_MAX_LEVEL,
  FLUID_TICK_BUDGET,
  LAVA_TICK_INTERVAL,
  FLOW_OFFSETS,
} from './fluid-model'
