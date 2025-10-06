import type { ComponentTypeName } from '@domain/entities/types'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer, Option, pipe } from 'effect'
import * as HashMap from 'effect/HashMap'
import { AllComponentDefinitions, PositionComponent, VelocityComponent } from './index'
import type { ComponentDefinition } from './index'

/**
 * コンポーネントスナップショット用スキーマ
 */
export const ComponentRegistrySchema = Schema.Struct({
  position: Schema.optional(PositionComponent),
  velocity: Schema.optional(VelocityComponent),
})
export type ComponentRegistrySnapshot = Schema.Schema.Type<typeof ComponentRegistrySchema>

/**
 * コンポーネントUnion
 */
export const ComponentUnion = Schema.Union(PositionComponent, VelocityComponent)
export type ComponentUnion = Schema.Schema.Type<typeof ComponentUnion>

export interface ComponentRegistryPort {
  readonly definitions: Effect.Effect<ReadonlyArray<ComponentDefinition<unknown>>, never>
  readonly definitionFor: <A>(type: ComponentTypeName) => Effect.Effect<Option.Option<ComponentDefinition<A>>, never>
}

export const ComponentRegistryService = Context.GenericTag<ComponentRegistryPort>(
  '@minecraft/infrastructure/ecs/ComponentRegistryService'
)

const definitionIndex = HashMap.fromIterable(
  AllComponentDefinitions.map((definition) => [definition.type, definition] as const)
)

const live: ComponentRegistryPort = {
  definitions: Effect.succeed(Array.from(AllComponentDefinitions)),
  definitionFor: (type) =>
    Effect.succeed(
      pipe(
        HashMap.get(definitionIndex, type),
        Option.map((definition) => definition as ComponentDefinition<any>)
      )
    ),
}

export const ComponentRegistryLive = Layer.succeed(ComponentRegistryService, live)
