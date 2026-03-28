import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { Block, BlockType } from './block'
import { BlockId } from '@/shared/kernel'

type BlockMap = HashMap.HashMap<BlockType, Block>

export class BlockRegistry extends Effect.Service<BlockRegistry>()(
  '@minecraft/domain/BlockRegistry',
  {
    effect: Effect.gen(function* () {
      // Build the initial registry immutably from the static block list — no loop needed
      const registryRef = yield* Ref.make<BlockMap>(
        HashMap.fromIterable(Arr.map(initialBlocks, (b) => [b.type, b] as [BlockType, Block]))
      )

      return {
        register: (block: Block): Effect.Effect<void, never> =>
          Ref.update(registryRef, (registry) => HashMap.set(registry, block.type, block)),
        get: (blockType: BlockType): Effect.Effect<Option.Option<Block>, never> =>
          Ref.get(registryRef).pipe(
            Effect.map((registry) => HashMap.get(registry, blockType))
          ),
        getAll: (): Effect.Effect<ReadonlyArray<Block>, never> =>
          Ref.get(registryRef).pipe(
            Effect.map((registry) => Arr.fromIterable(HashMap.values(registry)))
          ),
        dispose: (): Effect.Effect<void, never> =>
          Ref.set(registryRef, HashMap.empty<BlockType, Block>()),
      }
    }),
  }
) {}

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

const makeBlockId = (id: string) => BlockId.make(id)

const initialBlocks: ReadonlyArray<Block> = [
  new Block({
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
  }),
  new Block({
    id: makeBlockId('block:dirt'),
    type: 'DIRT',
    properties: defaultBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:stone'),
    type: 'STONE',
    properties: {
      ...defaultBlockProperties,
      hardness: 100,
      friction: 0.8,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:wood'),
    type: 'WOOD',
    properties: {
      ...defaultBlockProperties,
      hardness: 30,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:grass'),
    type: 'GRASS',
    properties: {
      ...defaultBlockProperties,
      hardness: 20,
      emissive: true,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:sand'),
    type: 'SAND',
    properties: {
      ...defaultBlockProperties,
      hardness: 10,
      friction: 0.5,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:water'),
    type: 'WATER',
    properties: {
      ...defaultBlockProperties,
      hardness: 0,
      transparency: true,
      solid: false,
      friction: 0,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:leaves'),
    type: 'LEAVES',
    properties: {
      ...defaultBlockProperties,
      hardness: 5,
      transparency: true,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:glass'),
    type: 'GLASS',
    properties: {
      ...defaultBlockProperties,
      hardness: 5,
      transparency: true,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:snow'),
    type: 'SNOW',
    properties: { hardness: 5, transparency: false, solid: true, emissive: false, friction: 0.3 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:gravel'),
    type: 'GRAVEL',
    properties: { hardness: 15, transparency: false, solid: true, emissive: false, friction: 0.5 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:cobblestone'),
    type: 'COBBLESTONE',
    properties: { hardness: 80, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
]
export const BlockRegistryLive = BlockRegistry.Default
