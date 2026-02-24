import { Effect, Context, Layer, Option, Ref, Schema } from 'effect'
import { Block, BlockType, BlockIdSchema } from './block'

type BlockMap = {
  readonly [K in BlockType]?: Block
}

export interface BlockRegistry {
  readonly register: (block: Block) => Effect.Effect<void, never>
  readonly get: (blockType: BlockType) => Effect.Effect<Option<Block>, never>
  readonly getAll: () => Effect.Effect<Array<Block>, never>
  readonly dispose: () => Effect.Effect<void, never>
}

export const BlockRegistry = Context.GenericTag<BlockRegistry>('@minecraft/BlockRegistry')

const defaultBlockProperties = {
  hardness: 50,
  transparency: false,
  solid: true,
  emissive: false,
  friction: 0.6,
}

const defaultBlockFaces = {
  top: true,
  bottom: true,
  north: true,
  south: true,
  east: true,
  west: true,
}

const BlockIdBrand = Schema.String.pipe(Schema.brand('BlockId'))

const makeBlockId = (id: string) => Schema.encodeSync(BlockIdBrand)(id)

const initialBlocks: Array<Block> = [
  {
    id: makeBlockId('block:air'),
    type: 'AIR',
    properties: {
      hardness: 0,
      transparency: true,
      solid: false,
      emissive: false,
      friction: 0,
    },
    faces: {
      top: false,
      bottom: false,
      north: false,
      south: false,
      east: false,
      west: false,
    },
  },
  {
    id: makeBlockId('block:dirt'),
    type: 'DIRT',
    properties: defaultBlockProperties,
    faces: defaultBlockFaces,
  },
  {
    id: makeBlockId('block:stone'),
    type: 'STONE',
    properties: {
      ...defaultBlockProperties,
      hardness: 100,
      friction: 0.8,
    },
    faces: defaultBlockFaces,
  },
  {
    id: makeBlockId('block:wood'),
    type: 'WOOD',
    properties: {
      ...defaultBlockProperties,
      hardness: 30,
    },
    faces: defaultBlockFaces,
  },
  {
    id: makeBlockId('block:grass'),
    type: 'GRASS',
    properties: {
      ...defaultBlockProperties,
      hardness: 20,
      emissive: true,
    },
    faces: defaultBlockFaces,
  },
  {
    id: makeBlockId('block:sand'),
    type: 'SAND',
    properties: {
      ...defaultBlockProperties,
      hardness: 10,
      friction: 0.5,
    },
    faces: defaultBlockFaces,
  },
]

export const BlockRegistryLive = Layer.effect(
  BlockRegistry,
  Effect.gen(function* () {
    const registryRef = yield* Ref.make<BlockMap>({})

    for (const block of initialBlocks) {
      yield* Ref.update(registryRef, (registry) => ({
        ...registry,
        [block.type]: block,
      }))
    }

    return BlockRegistry.of({
      register: (block) =>
        Effect.gen(function* () {
          yield* Ref.update(registryRef, (registry) => ({
            ...registry,
            [block.type]: block,
          }))
        }),
      get: (blockType) =>
        Ref.get(registryRef).pipe(
          Effect.map((registry) => {
            const block = registry[blockType]
            return block !== undefined ? Option.some(block) : Option.none()
          })
        ),
      getAll: () =>
        Ref.get(registryRef).pipe(
          Effect.map((registry) => Object.values(registry))
        ),
      dispose: () =>
        Ref.set(registryRef, {}),
    })
  })
)
