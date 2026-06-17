import { CHUNK_COLUMN_SAMPLE_COUNT } from '@ts-minecraft/world'

export type TerrainChannelTestSamples = Readonly<{
  readonly continentalness: Float64Array
  readonly erosion: Float64Array
  readonly pv: Float64Array
  readonly jaggedness: Float64Array
}>

type TerrainChannelDefaults = Readonly<
  Partial<{
    readonly continentalness: number
    readonly erosion: number
    readonly pv: number
    readonly jaggedness: number
  }>
>

const makeChannel = (value: number | undefined): Float64Array => {
  const channel = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
  if (value !== undefined) {
    channel.fill(value)
  }
  return channel
}

export const makeTerrainChannelSamples = (defaults: TerrainChannelDefaults = {}): TerrainChannelTestSamples => ({
  continentalness: makeChannel(defaults.continentalness),
  erosion: makeChannel(defaults.erosion),
  pv: makeChannel(defaults.pv),
  jaggedness: makeChannel(defaults.jaggedness),
})

export const makeChunkColumnArray = <A>(factory: (index: number) => A): Array<A> =>
  Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, (_, index) => factory(index))
