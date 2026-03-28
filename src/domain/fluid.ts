import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from './chunk'

export type FluidCell = Readonly<{
  readonly level: number
  readonly source: boolean
}>

export const FLUID_BYTE_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const FLUID_PRESENT_MASK = 0x80
const FLUID_SOURCE_MASK = 0x08
const FLUID_LEVEL_MASK = 0x07

export const createFluidBuffer = (): Uint8Array<ArrayBufferLike> => new Uint8Array(FLUID_BYTE_LENGTH)

export const encodeFluidCell = (cell: FluidCell): number =>
  FLUID_PRESENT_MASK |
  (cell.source ? FLUID_SOURCE_MASK : 0) |
  (cell.level & FLUID_LEVEL_MASK)

export const decodeFluidByte = (byte: number): Option.Option<FluidCell> =>
  (byte & FLUID_PRESENT_MASK) === 0
    ? Option.none()
    : Option.some({
      level: byte & FLUID_LEVEL_MASK,
      source: (byte & FLUID_SOURCE_MASK) !== 0,
    })

export const hydrateLegacyFluidBufferFromBlocks = (
  blocks: Uint8Array<ArrayBufferLike>,
  waterIndex: number,
): Uint8Array<ArrayBufferLike> => {
  const fluid = createFluidBuffer()
  blocks.forEach((byte, i) => {
    if (byte === waterIndex) {
      fluid[i] = encodeFluidCell({ level: 0, source: true })
    }
  })
  return fluid
}
