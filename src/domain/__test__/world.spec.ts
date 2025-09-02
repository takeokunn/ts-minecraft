import { Effect, Ref } from 'effect'
import { describe, expect, it } from 'vitest'
import { WorldContext } from '@/runtime/context'
import { createArchetype } from '../archetypes'
import { createTargetBlock, createTargetNone } from '../components'
import { toEntityId } from '../entity'
import {
  addArchetype,
  createInitialWorld,
  getComponent,
  getComponentOption,
  query,
  recordBlockPlacement,
  updateComponent,
  worldLayer,
} from '../world'

const Player = createArchetype({
  type: 'player',
  pos: { x: 0, y: 80, z: 0 },
})

describe('world', () => {
  it('should create a world', () => {
    const world = createInitialWorld()
    expect(world).toBeDefined()
  })

  it('should add an archetype', () => {
    const program = Effect.gen(function* ($) {
      const entityId = yield* $(addArchetype(Player))
      const position = yield* $(getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 0, y: 80, z: 0 })
    })

    const effect = program.pipe(Effect.provide(worldLayer))
    Effect.runSync(effect)
  })

  it('should update a component', () => {
    const program = Effect.gen(function* ($) {
      const entityId = yield* $(addArchetype(Player))
      yield* $(updateComponent(entityId, 'position', { x: 1, y: 2, z: 3 }))
      const position = yield* $(getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 1, y: 2, z: 3 })
    })

    const effect = program.pipe(Effect.provide(worldLayer))
    Effect.runSync(effect)
  })

  it('should query entities', () => {
    const program = Effect.gen(function* ($) {
      const entityId = yield* $(addArchetype(Player))
      const results = yield* $(query({ name: 'test', components: ['position'] }))
      expect(results).toEqual([{ entityId, position: { x: 0, y: 80, z: 0 } }])
    })

    const effect = program.pipe(Effect.provide(worldLayer))
    Effect.runSync(effect)
  })

  it('should get an optional component', () => {
    const program = Effect.gen(function* ($) {
      const entityId = yield* $(addArchetype({}))
      const target = yield* $(getComponentOption(entityId, 'target'))
      expect(target).toEqual({ _tag: 'None' })

      yield* $(updateComponent(entityId, 'target', createTargetNone()))
      const target2 = yield* $(getComponentOption(entityId, 'target'))
      expect(target2).toEqual({ _tag: 'Some', value: { _tag: 'none' } })

      const entityId2 = toEntityId(1)
      yield* $(
        updateComponent(
          entityId2,
          'target',
          createTargetBlock(toEntityId(2), { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }),
        ),
      )
      const target3 = yield* $(getComponentOption(entityId, 'target'))
      expect(target3).toEqual({ _tag: 'Some', value: { _tag: 'none' } })
    })

    const effect = program.pipe(Effect.provide(worldLayer))
    Effect.runSync(effect)
  })

  it('should record block placements', () => {
    const program = Effect.gen(function* ($) {
      yield* $(
        recordBlockPlacement({
          position: { x: 1, y: 2, z: 3 },
          blockType: 'stone',
        }),
      )
      const worldContext = yield* $(WorldContext)
      const worldState = yield* $(Ref.get(worldContext.world))
      expect(worldState.globalState.editedBlocks.placed).toEqual({
        '1,2,3': {
          position: { x: 1, y: 2, z: 3 },
          blockType: 'stone',
        },
      })
    })

    const effect = program.pipe(Effect.provide(worldLayer))
    Effect.runSync(effect)
  })
})
