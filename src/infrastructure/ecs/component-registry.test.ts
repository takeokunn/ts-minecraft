import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { Effect, Option, pipe } from 'effect'
import { expect } from 'vitest'
import {
  AllComponentDefinitions,
  PositionComponentDefinition,
  VelocityComponentDefinition,
} from './Component'
import {
  ComponentRegistryLive,
  ComponentRegistryService,
} from './ComponentRegistry'
import { ComponentTypeNameSchema } from '@domain/entities/types'
import { provideLayers } from '../../testing/effect'

const provideRegistry = <A, E>(effect: Effect.Effect<A, E>) =>
  provideLayers(effect, ComponentRegistryLive)

it.effect('コンポーネント定義一覧を取得できる', () =>
  provideRegistry(
    Effect.gen(function* () {
      const registry = yield* ComponentRegistryService
      const definitions = yield* registry.definitions

      expect(definitions).toHaveLength(AllComponentDefinitions.length)
      expect(definitions).toEqual(expect.arrayContaining(Array.from(AllComponentDefinitions)))
    })
  )
)

it.effect('登録済みコンポーネント定義を取得できる', () =>
  provideRegistry(
    Effect.gen(function* () {
      const registry = yield* ComponentRegistryService
      const maybeDefinition = yield* registry.definitionFor(PositionComponentDefinition.type)

      yield* pipe(
        maybeDefinition,
        Option.match({
          onNone: () => Effect.fail(new Error('定義が見つかりませんでした')), 
          onSome: (definition) =>
            definition.validate({ x: 1, y: 2, z: 3 }).pipe(
              Effect.tap((decoded) =>
                Effect.sync(() => {
                  expect(definition).toBe(PositionComponentDefinition)
                  expect(decoded).toEqual({ x: 1, y: 2, z: 3 })
                })
              )
            ),
        })
      )
    })
  )
)

it.effect('未登録コンポーネント定義は Option.none になる', () =>
  provideRegistry(
    Effect.gen(function* () {
      const registry = yield* ComponentRegistryService
      const knownDefinition = yield* registry.definitionFor(VelocityComponentDefinition.type)

      expect(Option.isSome(knownDefinition)).toBe(true)

      const unknownType = Schema.decodeUnknownSync(ComponentTypeNameSchema)('UnknownComponent')
      const unknownDefinition = yield* registry.definitionFor(unknownType)

      expect(Option.isNone(unknownDefinition)).toBe(true)
    })
  )
)
