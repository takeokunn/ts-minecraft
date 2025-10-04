import { Clock, Duration, Effect, Either, HashMap, Layer, Match, Option, pipe } from 'effect'
import * as Array_ from 'effect/Array'
import { burnTimeByItemId, getEfficiencyKey, toolEfficiencyByKey } from './catalog'
import { ensureFortuneLevel, getToolHarvestLevel } from './helper'
import { MaterialRepository, MaterialRepositoryLayer } from './repository'
import type { MaterialService as MaterialServiceInterface } from './service'
import { MaterialService as MaterialServiceTag } from './service'
import {
  BlockId,
  BurnTime,
  FortuneLevel,
  ItemId,
  ItemStack,
  Material,
  MaterialError,
  Tool,
  MaterialEvent as MaterialEventConstructor,
} from './types'

const ensureToolPresence = (
  material: Material,
  maybeTool: Option.Option<Tool>
): Either.Either<MaterialError, Option.Option<Tool>> =>
  pipe(
    maybeTool,
    Option.match({
      onNone: () =>
        pipe(
          Match.value(material.tool.required),
          Match.when(true, () => Either.left(MaterialError.ToolRequired({ blockId: material.blockId }))),
          Match.orElse(() => Either.right(Option.none<Tool>()))
        ),
      onSome: (tool) => Either.right(Option.some(tool)),
    })
  )

const ensureHarvestLevel = (material: Material, tool: Tool): Either.Either<MaterialError, Tool> => {
  const level = getToolHarvestLevel(tool.material)
  return pipe(
    Match.value(level >= material.tool.minimumLevel),
    Match.when(true, () => Either.right(tool)),
    Match.orElse(() =>
      Either.left(
        MaterialError.HarvestLevelInsufficient({
          blockId: material.blockId,
          requiredLevel: material.tool.minimumLevel,
          toolLevel: level,
        })
      )
    )
  )
}

const ensureToolType = (material: Material, tool: Tool): Either.Either<MaterialError, Tool> =>
  pipe(
    material.tool.preferredTypes,
    Array_.some((preferred) => preferred === tool.type),
    Match.value,
    Match.when(true, () => Either.right(tool)),
    Match.orElse(() =>
      Either.left(
        MaterialError.ToolMismatch({
          blockId: material.blockId,
          expected: material.tool.preferredTypes,
          actual: tool.type,
        })
      )
    )
  )

const validateTool = (
  material: Material,
  maybeTool: Option.Option<Tool>
): Either.Either<MaterialError, Option.Option<Tool>> =>
  pipe(
    ensureToolPresence(material, maybeTool),
    Either.flatMap((present) =>
      pipe(
        present,
        Option.match({
          onNone: () => Either.right<Option.Option<Tool>>(Option.none()),
          onSome: (tool) =>
            pipe(
              ensureHarvestLevel(material, tool),
              Either.flatMap((validTool) => ensureToolType(material, validTool)),
              Either.map((validTool) => Option.some(validTool))
            )
        })
      )
    )
  )

const computeToolEfficiency = (material: Material, tool: Option.Option<Tool>): number =>
  pipe(
    tool,
    Option.match({
      onNone: () => 1,
      onSome: (provided) =>
        pipe(
          HashMap.get(toolEfficiencyByKey, getEfficiencyKey(provided.type, provided.material, material.category)),
          Option.match({
            onNone: () => 1,
            onSome: (efficiency) => efficiency.speedMultiplier,
          })
        ),
    })
  )

const computeEnchantmentMultiplier = (tool: Option.Option<Tool>): number =>
  pipe(
    tool,
    Option.map((provided) => pipe(provided.enchantments, Array_.filter((enchantment) => enchantment.type === 'efficiency'), Array_.reduce(1, (accumulator, enchantment) => accumulator + enchantment.level * 0.3))),
    Option.getOrElse(() => 1)
  )

const computeSpeed = (material: Material, tool: Option.Option<Tool>): number =>
  computeToolEfficiency(material, tool) * computeEnchantmentMultiplier(tool)

const miningDurationFor = (material: Material, tool: Option.Option<Tool>): Duration.Duration =>
  pipe(
    computeSpeed(material, tool),
    (speed) =>
      pipe(
        Match.value(speed <= 0),
        Match.when(true, () => Duration.infinity),
        Match.orElse(() => Duration.millis((material.hardness * 1.5) / speed * 50))
      )
  )

const hasSilkTouch = (tool: Option.Option<Tool>): boolean =>
  pipe(
    tool,
    Option.exists((provided) => pipe(provided.enchantments, Array_.some((enchantment) => enchantment.type === 'silk_touch')))
  )

const silkTouchDrops = (material: Material): ReadonlyArray.ReadonlyArray<ItemStack> => [
  { itemId: material.defaultItemId, amount: 1 },
]

const applyFortune = (
  drops: ReadonlyArray.ReadonlyArray<ItemStack>,
  fortune: FortuneLevel,
  material: Material
): ReadonlyArray.ReadonlyArray<ItemStack> =>
  pipe(
    Array_.some(material.tags, (tag) => tag === 'ore') && fortune > 0,
    Match.value,
    Match.when(true, () =>
      pipe(drops, Array_.map((drop) => ({ itemId: drop.itemId, amount: Math.max(1, drop.amount * (fortune + 1)) })))
    ),
    Match.orElse(() => drops)
  )

const computeDrops = (
  material: Material,
  tool: Option.Option<Tool>,
  fortune: FortuneLevel
): ReadonlyArray.ReadonlyArray<ItemStack> =>
  pipe(
    hasSilkTouch(tool),
    Match.value,
    Match.when(true, () => silkTouchDrops(material)),
    Match.orElse(() => applyFortune(material.drops, fortune, material))
  )

const burnTimeFor = (itemId: ItemId): Option.Option<BurnTime> => HashMap.get(burnTimeByItemId, itemId)

const fromEither = <E, A>(either: Either.Either<E, A>): Effect.Effect<A, E> =>
  pipe(
    either,
    Either.match({
      onLeft: (error) => Effect.fail(error),
      onRight: (value) => Effect.succeed(value),
    })
  )

const makeService = Effect.gen(function* () {
  const repository = yield* MaterialRepository

  const getMaterial: MaterialServiceInterface['getMaterial'] = (blockId) => repository.getByBlockId(blockId)

  const canHarvest: MaterialServiceInterface['canHarvest'] = (material, tool) =>
    pipe(
      validateTool(material, tool),
      Either.match({
        onLeft: () => false,
        onRight: () => true,
      }),
      Effect.succeed
    )

  const miningTime: MaterialServiceInterface['miningTime'] = (material, tool) =>
    pipe(
      validateTool(material, tool),
      Either.match({
        onLeft: () => Duration.infinity,
        onRight: (validated) => miningDurationFor(material, validated),
      }),
      Effect.succeed
    )

  const drops: MaterialServiceInterface['drops'] = (material, tool, fortuneInput) =>
    Effect.gen(function* () {
      const fortune = yield* fromEither(ensureFortuneLevel(fortuneInput))
      const validatedTool = yield* fromEither(validateTool(material, tool))
      return computeDrops(material, validatedTool, fortune)
    })

  const burnTime: MaterialServiceInterface['burnTime'] = (itemId) => Effect.succeed(burnTimeFor(itemId))

  const harvest: MaterialServiceInterface['harvest'] = (blockId, tool, fortuneInput) =>
    Effect.gen(function* () {
      const material = yield* getMaterial(blockId)
      const fortune = yield* fromEither(ensureFortuneLevel(fortuneInput))
      const validatedTool = yield* fromEither(validateTool(material, tool))
      const harvestedDrops = computeDrops(material, validatedTool, fortune)
      const timestamp = yield* Clock.currentTimeMillis
      return MaterialEventConstructor.Harvested({
        blockId: material.blockId,
        drops: harvestedDrops,
        timestampMillis: timestamp,
      })
    })

  const service: MaterialServiceInterface = {
    getMaterial,
    canHarvest,
    miningTime,
    drops,
    burnTime,
    harvest,
  }

  return service
})

export const MaterialServiceLayer = Layer.effect(MaterialServiceTag, makeService).pipe(
  Layer.provide(MaterialRepositoryLayer)
)
