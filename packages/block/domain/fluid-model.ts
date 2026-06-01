import { Brand, HashMap, HashSet } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT } from '@ts-minecraft/core'

export type FluidType = 'water' | 'lava'

export type FluidCell = Readonly<{
  readonly level: number
  readonly source: boolean
  readonly type: FluidType
}>

export const AIR_INDEX = blockTypeToIndex('AIR')
export const WATER_INDEX = blockTypeToIndex('WATER')
export const LAVA_INDEX = blockTypeToIndex('LAVA')
export const WATER_MAX_LEVEL = 7
export const LAVA_MAX_LEVEL = 3
export const FLUID_TICK_BUDGET = 512
// Lava ticks every 3rd world tick (vanilla-like slowdown).
export const LAVA_TICK_INTERVAL = 3

export const FLOW_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
] as const

export const NOTIFY_OFFSETS = [
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
] as const

export type FluidKey = number & Brand.Brand<'FluidKey'>
export const FluidKey = Brand.nominal<FluidKey>()

export type FluidState = Readonly<{
  readonly cells: HashMap.HashMap<FluidKey, FluidCell>
  readonly frontier: HashSet.HashSet<FluidKey>
  readonly tickCounter: number
}>

export const INITIAL_STATE: FluidState = {
  cells: HashMap.empty(),
  frontier: HashSet.empty(),
  tickCounter: 0,
}

export const BIAS = 32768
export const Y_STRIDE = 65536
export const XZ_STRIDE = CHUNK_HEIGHT * Y_STRIDE
