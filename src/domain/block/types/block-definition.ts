import { pipe } from 'effect/Function'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Match from 'effect/Match'
import * as Schema from 'effect/Schema'
import type { ParseError } from 'effect/ParseResult'
import type { BlockIdentity, BlockIdentityError } from '../value_object/block-identity'
import { assembleIdentity } from '../value_object/block-identity'
import type { BlockProperties } from './block-properties'
import { BlockPropertiesError, makeBlockProperties } from './block-properties'

// =============================================================================
// Block Definition ADT
// =============================================================================

export type BlockDefinition = Data.TaggedEnum<{
  Standard: {
    readonly identity: BlockIdentity
    readonly properties: BlockProperties
  }
  Liquid: {
    readonly identity: BlockIdentity
    readonly properties: BlockProperties
    readonly viscosity: number
    readonly flowRange: number
  }
  Interactive: {
    readonly identity: BlockIdentity
    readonly properties: BlockProperties
    readonly interactionId: string
    readonly inventorySize?: number
  }
}>

export const BlockDefinition = Data.taggedEnum<BlockDefinition>()

const LiquidSchema = Schema.Struct({
  viscosity: Schema.Number.pipe(Schema.positive()),
  flowRange: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

const InteractiveSchema = Schema.Struct({
  interactionId: Schema.String.pipe(Schema.minLength(1)),
  inventorySize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

export type BlockDefinitionError = Data.TaggedEnum<{
  IdentityError: { readonly cause: BlockIdentityError }
  PropertyError: { readonly cause: BlockPropertiesError }
  LiquidError: { readonly issues: ParseError }
  InteractiveError: { readonly issues: ParseError }
}>

export const BlockDefinitionError = Data.taggedEnum<BlockDefinitionError>()

// =============================================================================
// Constructors
// =============================================================================

export const makeStandardBlock = (
  input: {
    readonly id: string
    readonly name: string
    readonly tags?: Iterable<string>
    readonly properties?: Parameters<typeof makeBlockProperties>[0]
  }
) =>
  Effect.gen(function* () {
    const identityInput = {
      id: input.id,
      name: input.name,
      ...(input.tags ? { tags: input.tags } : {}),
    } as const

    const identity = yield* Effect.mapError(
      assembleIdentity(identityInput),
      (cause) => BlockDefinitionError.IdentityError({ cause })
    )

    const properties = yield* Effect.mapError(
      makeBlockProperties(input.properties),
      (cause) => BlockDefinitionError.PropertyError({ cause })
    )

    return BlockDefinition.Standard({ identity, properties })
  })

const mapBlockPropertiesError = (error: BlockPropertiesError) =>
  BlockDefinitionError.PropertyError({ cause: error })

export const makeLiquidBlock = (
  input: {
    readonly id: string
    readonly name: string
    readonly tags?: Iterable<string>
    readonly properties?: Parameters<typeof makeBlockProperties>[0]
    readonly viscosity: number
    readonly flowRange: number
  }
) =>
  Effect.gen(function* () {
    const identityInput = {
      id: input.id,
      name: input.name,
      ...(input.tags ? { tags: input.tags } : {}),
    } as const

    const identity = yield* Effect.mapError(
      assembleIdentity(identityInput),
      (cause) => BlockDefinitionError.IdentityError({ cause })
    )

    const propertiesInput: Parameters<typeof makeBlockProperties>[0] = {
      ...input.properties,
      physics: {
        ...(input.properties?.physics ?? {}),
        liquid: true,
        replaceable: true,
        pushable: false,
        solid: false,
      },
    }

    const properties = yield* Effect.mapError(
      makeBlockProperties(propertiesInput),
      mapBlockPropertiesError
    )

    const liquid = yield* pipe(
      Schema.decode(LiquidSchema)({
        viscosity: input.viscosity,
        flowRange: input.flowRange,
      }),
      Effect.mapError((issues) => BlockDefinitionError.LiquidError({ issues }))
    )

    return BlockDefinition.Liquid({
      identity,
      properties,
      viscosity: liquid.viscosity,
      flowRange: liquid.flowRange,
    })
  })

export const makeInteractiveBlock = (
  input: {
    readonly id: string
    readonly name: string
    readonly tags?: Iterable<string>
    readonly properties?: Parameters<typeof makeBlockProperties>[0]
    readonly interactionId: string
    readonly inventorySize?: number
  }
) =>
  Effect.gen(function* () {
    const identityInput = {
      id: input.id,
      name: input.name,
      ...(input.tags ? { tags: input.tags } : {}),
    } as const

    const identity = yield* Effect.mapError(
      assembleIdentity(identityInput),
      (cause) => BlockDefinitionError.IdentityError({ cause })
    )

    const properties = yield* Effect.mapError(
      makeBlockProperties(input.properties),
      mapBlockPropertiesError
    )

    const interactive = yield* pipe(
      Schema.decode(InteractiveSchema)({
        interactionId: input.interactionId,
        inventorySize: input.inventorySize,
      }),
      Effect.mapError((issues) => BlockDefinitionError.InteractiveError({ issues }))
    )

    const interactivePayload = {
      identity,
      properties,
      interactionId: interactive.interactionId,
      ...(interactive.inventorySize !== undefined
        ? { inventorySize: interactive.inventorySize }
        : {}),
    } as const

    return BlockDefinition.Interactive(interactivePayload)
  })

export const makeBlockDefinition = (
  input:
    | ({ readonly kind: 'standard' } & Parameters<typeof makeStandardBlock>[0])
    | ({ readonly kind: 'liquid' } & Parameters<typeof makeLiquidBlock>[0])
    | ({ readonly kind: 'interactive' } & Parameters<typeof makeInteractiveBlock>[0])
) =>
  Match.value(input).pipe(
    Match.when({ kind: 'standard' }, makeStandardBlock),
    Match.when({ kind: 'liquid' }, makeLiquidBlock),
    Match.when({ kind: 'interactive' }, makeInteractiveBlock),
    Match.exhaustive
  )
