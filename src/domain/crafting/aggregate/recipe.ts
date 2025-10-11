import { Array, DateTime, Effect, HashSet, Match, Option, Record, Schema, pipe } from 'effect'
import {
  CraftingGrid,
  CraftingItemStack,
  CraftingRecipe,
  InvalidRecipeError,
  ItemMatcher,
  ItemTag,
  ItemTagSchema,
  PatternMismatchError,
  RecipeId,
  RecipePatternKey,
  RecipeValidationIssue,
  ShapedRecipe,
  ShapelessRecipe,
  slotAt,
} from '../types'

/**
 * ### ブランド値オブジェクト
 */
export const CraftingDifficultySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(10),
  Schema.brand('CraftingDifficulty')
)
export type CraftingDifficulty = Schema.Schema.Type<typeof CraftingDifficultySchema>

export const CraftingTimeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(10),
  Schema.lessThanOrEqualTo(300_000),
  Schema.brand('CraftingTime')
)
export type CraftingTime = Schema.Schema.Type<typeof CraftingTimeSchema>

export const SuccessRateSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0.01),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('SuccessRate')
)
export type SuccessRate = Schema.Schema.Type<typeof SuccessRateSchema>

const RecipeMetadataSchema = Schema.Struct({
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  tags: Schema.Array(ItemTagSchema),
  createdBy: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
})
export type RecipeMetadata = Schema.Schema.Type<typeof RecipeMetadataSchema>

export interface RecipeAggregate {
  readonly _tag: 'RecipeAggregate'
  readonly id: RecipeId
  readonly recipe: CraftingRecipe
  readonly difficulty: CraftingDifficulty
  readonly craftingTime: CraftingTime
  readonly successRate: SuccessRate
  readonly metadata: RecipeMetadata
}

export interface CreateRecipeAggregateInput {
  readonly id: RecipeId
  readonly recipe: CraftingRecipe
  readonly difficulty: CraftingDifficulty
  readonly craftingTime: CraftingTime
  readonly successRate: SuccessRate
  readonly createdBy?: string
  readonly tags?: ReadonlyArray<ItemTag>
  readonly notes?: string
}

/**
 * ### 集約生成
 */
export const createRecipeAggregate = (
  input: CreateRecipeAggregateInput
): Effect.Effect<RecipeAggregate, InvalidRecipeError> =>
  Effect.gen(function* () {
    yield* validateRecipeStructure(input.recipe)

    const tags: ReadonlyArray<ItemTag> = input.tags ?? []
    const now = yield* currentDate()

    const metadata = yield* Schema.decode(RecipeMetadataSchema)({
      createdAt: now,
      updatedAt: now,
      version: 1,
      tags,
      createdBy: input.createdBy,
      notes: input.notes,
    })

    return {
      _tag: 'RecipeAggregate',
      id: input.id,
      recipe: input.recipe,
      difficulty: input.difficulty,
      craftingTime: input.craftingTime,
      successRate: input.successRate,
      metadata,
    }
  })

/**
 * ### レシピ構造検証
 */
export const validateRecipeStructure = (recipe: CraftingRecipe): Effect.Effect<void, InvalidRecipeError> => {
  const issues = collectRecipeIssues(recipe)
  return Effect.if(Effect.succeed(Array.isEmptyReadonlyArray(issues)), {
    onTrue: () => Effect.void,
    onFalse: () =>
      Effect.fail(
        new InvalidRecipeError({
          recipeId: recipe.id,
          issues,
        })
      ),
  })
}

/**
 * ### レシピ妥当性レポート
 */
export interface RecipeValidationReport {
  readonly valid: boolean
  readonly issues: ReadonlyArray<RecipeValidationIssue>
}

export const validateRecipe = (recipe: CraftingRecipe): Effect.Effect<RecipeValidationReport, never> =>
  pipe(
    collectRecipeIssues(recipe),
    (issues) => ({
      valid: Array.isEmptyReadonlyArray(issues),
      issues,
    }),
    Effect.succeed
  )

/**
 * ### 集約状態更新
 */
export const updateDifficulty = (
  aggregate: RecipeAggregate,
  difficulty: CraftingDifficulty
): Effect.Effect<RecipeAggregate, never> =>
  pipe(
    touchMetadata(aggregate.metadata),
    Effect.map((metadata) => ({
      ...aggregate,
      difficulty,
      metadata,
    }))
  )

export const updateCraftingTime = (
  aggregate: RecipeAggregate,
  craftingTime: CraftingTime
): Effect.Effect<RecipeAggregate, never> =>
  pipe(
    touchMetadata(aggregate.metadata),
    Effect.map((metadata) => ({
      ...aggregate,
      craftingTime,
      metadata,
    }))
  )

export const updateSuccessRate = (
  aggregate: RecipeAggregate,
  successRate: SuccessRate
): Effect.Effect<RecipeAggregate, never> =>
  pipe(
    touchMetadata(aggregate.metadata),
    Effect.map((metadata) => ({
      ...aggregate,
      successRate,
      metadata,
    }))
  )

export const addTag = (aggregate: RecipeAggregate, tag: ItemTag): Effect.Effect<RecipeAggregate, never> =>
  Effect.if(Effect.succeed(Array.contains(tag)(aggregate.metadata.tags)), {
    onTrue: () => Effect.succeed(aggregate),
    onFalse: () =>
      pipe(
        touchMetadata(aggregate.metadata),
        Effect.map((metadata) => ({
          ...aggregate,
          metadata: {
            ...metadata,
            tags: [...aggregate.metadata.tags, tag],
          },
        }))
      ),
  })

export const removeTag = (aggregate: RecipeAggregate, tag: ItemTag): Effect.Effect<RecipeAggregate, never> =>
  Effect.if(Effect.succeed(Array.contains(tag)(aggregate.metadata.tags)), {
    onTrue: () =>
      pipe(
        touchMetadata(aggregate.metadata),
        Effect.map((metadata) => ({
          ...aggregate,
          metadata: {
            ...metadata,
            tags: aggregate.metadata.tags.filter((current) => current !== tag),
          },
        }))
      ),
    onFalse: () => Effect.succeed(aggregate),
  })

export const updateDescription = (
  aggregate: RecipeAggregate,
  description: string | undefined
): Effect.Effect<RecipeAggregate, never> =>
  pipe(
    touchMetadata(aggregate.metadata),
    Effect.map((metadata) => ({
      ...aggregate,
      metadata: {
        ...metadata,
        notes: description,
      },
    }))
  )

export const cloneRecipeAggregate = (
  aggregate: RecipeAggregate,
  newId: RecipeId
): Effect.Effect<RecipeAggregate, InvalidRecipeError> =>
  createRecipeAggregate({
    id: newId,
    recipe: aggregate.recipe,
    difficulty: aggregate.difficulty,
    craftingTime: aggregate.craftingTime,
    successRate: aggregate.successRate,
    createdBy: aggregate.metadata.createdBy,
    tags: aggregate.metadata.tags,
    notes: aggregate.metadata.notes,
  })

/**
 * ### グリッド適合判定
 */
export const canCraftWithGrid = (
  aggregate: RecipeAggregate,
  grid: CraftingGrid
): Effect.Effect<boolean, PatternMismatchError> =>
  pipe(
    Match.value(aggregate.recipe).pipe(
      Match.tag('shaped', (recipe) => matchShapedRecipe(recipe, grid)),
      Match.tag('shapeless', (recipe) => matchShapelessRecipe(recipe, grid)),
      Match.exhaustive
    ),
    (matches) =>
      Effect.if(Effect.succeed(matches), {
        onTrue: () => Effect.succeed(true),
        onFalse: () =>
          Effect.fail(
            new PatternMismatchError({
              recipeId: aggregate.id,
              reason: 'provided grid does not match the recipe definition',
            })
          ),
      })
  )

/**
 * ### 内部ユーティリティ
 */
const currentDate = (): Effect.Effect<Date, never> => DateTime.nowAsDate

const touchMetadata = (metadata: RecipeMetadata): Effect.Effect<RecipeMetadata, never> =>
  pipe(
    currentDate(),
    Effect.map((date) => ({
      ...metadata,
      updatedAt: date,
      version: metadata.version + 1,
    }))
  )

const collectRecipeIssues = (recipe: CraftingRecipe): ReadonlyArray<RecipeValidationIssue> =>
  Match.value(recipe).pipe(
    Match.tag('shaped', collectShapedRecipeIssues),
    Match.tag('shapeless', collectShapelessRecipeIssues),
    Match.exhaustive
  )

const collectShapedRecipeIssues = (recipe: ShapedRecipe): ReadonlyArray<RecipeValidationIssue> => {
  const firstRow = Array.head(recipe.pattern)

  const emptyPatternIssues = Option.match(firstRow, {
    onNone: () => [issue('pattern must contain at least one row', ['pattern'])],
    onSome: () => Array.empty<RecipeValidationIssue>(),
  })

  const rowLengthIssues = Option.match(firstRow, {
    onNone: () => Array.empty<RecipeValidationIssue>(),
    onSome: (row) => {
      const targetLength = row.length
      const indices = Array.range(0, recipe.pattern.length - 1)
      return pipe(
        Array.zip(recipe.pattern, indices),
        Array.filterMap(([patternRow, index]) =>
          patternRow.length === targetLength
            ? Option.none()
            : Option.some(issue('pattern rows must share the same length', ['pattern', String(index)]))
        )
      )
    },
  })

  const patternKeys = pipe(
    recipe.pattern,
    Array.flatMap((row) =>
      pipe(
        row,
        Array.filterMap((cell) => Option.fromNullable(cell))
      )
    )
  )

  const ingredientKeySet = pipe(
    recipe.ingredients,
    Array.map((ingredient) => ingredient.key),
    HashSet.fromIterable
  )

  const usedKeySet = HashSet.fromIterable(patternKeys)

  const missingKeyIssues = pipe(
    patternKeys,
    Array.filterMap((key) =>
      HashSet.has(ingredientKeySet, key)
        ? Option.none()
        : Option.some(issue(`missing ingredient for pattern key ${key}`, ['ingredients', key]))
    )
  )

  const unusedKeyIssues = pipe(
    recipe.ingredients,
    Array.filterMap((ingredient) =>
      HashSet.has(usedKeySet, ingredient.key)
        ? Option.none()
        : Option.some(issue('ingredient key not present in pattern', ['ingredients', ingredient.key]))
    )
  )

  const duplicateKeyIssues = pipe(
    Array.groupBy(recipe.ingredients, (ingredient) => ingredient.key),
    Record.toEntries,
    Array.filterMap(([key, group]) =>
      group.length <= 1 ? Option.none() : Option.some(issue('duplicate ingredient key detected', ['ingredients', key]))
    )
  )

  return pipe(
    [emptyPatternIssues, rowLengthIssues, missingKeyIssues, unusedKeyIssues, duplicateKeyIssues],
    Array.flatten
  )
}

const collectShapelessRecipeIssues = (recipe: ShapelessRecipe): ReadonlyArray<RecipeValidationIssue> =>
  pipe(
    Array.groupBy(recipe.ingredients, (matcher) =>
      matcher._tag === 'exact' ? matcher.item.itemId : `tag:${matcher.tag}`
    ),
    Record.toEntries,
    Array.filterMap(([identifier, group]) =>
      group.length <= 1
        ? Option.none()
        : Option.some(issue('duplicate shapeless ingredient matcher', ['ingredients', identifier]))
    )
  )

const issue = (message: string, path: ReadonlyArray<string>): RecipeValidationIssue => ({
  message,
  path: Array.from(path),
})

export const matchShapedRecipe = (recipe: ShapedRecipe, grid: CraftingGrid): boolean => {
  const patternHeight = recipe.pattern.length
  const patternWidth = Option.match(Array.head(recipe.pattern), {
    onNone: () => 0,
    onSome: (row) => row.length,
  })

  const gridHeight = Number(grid.height)
  const gridWidth = Number(grid.width)

  const offsetsY = gridHeight >= patternHeight ? Array.range(0, gridHeight - patternHeight) : Array.empty<number>()
  const offsetsX = gridWidth >= patternWidth ? Array.range(0, gridWidth - patternWidth) : Array.empty<number>()

  return pipe(
    offsetsY,
    Array.flatMap((offsetY) =>
      pipe(
        offsetsX,
        Array.map((offsetX) => ({ offsetX, offsetY }))
      )
    ),
    Array.some(({ offsetX, offsetY }) =>
      pipe(
        recipe.pattern,
        Array.every((row, rowIndex) =>
          pipe(
            row,
            Array.every((cell, columnIndex) =>
              Option.match(Option.fromNullable(cell), {
                onNone: () =>
                  pipe(
                    slotAt(grid, { x: offsetX + columnIndex, y: offsetY + rowIndex }),
                    Option.match({
                      onNone: () => true,
                      onSome: (slot) => slot._tag === 'EmptySlot',
                    })
                  ),
                onSome: (key) =>
                  pipe(
                    slotAt(grid, { x: offsetX + columnIndex, y: offsetY + rowIndex }),
                    Option.flatMap((slot) =>
                      slot._tag === 'OccupiedSlot' ? Option.some(slot.stack) : Option.none<CraftingItemStack>()
                    ),
                    Option.match({
                      onNone: () => false,
                      onSome: (stack) => matchesIngredientByKey(recipe, key, stack),
                    })
                  ),
              })
            )
          )
        )
      )
    )
  )
}

export const matchShapelessRecipe = (recipe: ShapelessRecipe, grid: CraftingGrid): boolean => {
  const stacks = pipe(
    grid.slots,
    Array.filterMap((slot) =>
      slot._tag === 'OccupiedSlot' ? Option.some(slot.stack) : Option.none<CraftingItemStack>()
    )
  )

  return pipe(
    recipe.ingredients,
    Array.reduce<Option.Option<ReadonlyArray<CraftingItemStack>>>(Option.some(stacks), (state, matcher) =>
      Option.flatMap(state, (remaining) =>
        pipe(
          removeFirstMatching(remaining, (stack) => matcherMatchesItem(matcher, stack)),
          Option.map(({ rest }) => rest)
        )
      )
    ),
    Option.isSome
  )
}

const removeFirstMatching = <A>(
  items: ReadonlyArray<A>,
  predicate: (value: A) => boolean
): Option.Option<{ readonly rest: ReadonlyArray<A> }> =>
  pipe(
    items,
    Array.reduce({ removed: false, acc: Array.empty<A>() }, (state, current) =>
      state.removed
        ? { removed: true, acc: [...state.acc, current] }
        : predicate(current)
          ? { removed: true, acc: state.acc }
          : { removed: false, acc: [...state.acc, current] }
    ),
    (state) => (state.removed ? Option.some({ rest: state.acc }) : Option.none())
  )

const matchesIngredientByKey = (recipe: ShapedRecipe, key: RecipePatternKey, stack: CraftingItemStack): boolean =>
  pipe(
    recipe.ingredients,
    Array.findFirst((ingredient) => ingredient.key === key),
    Option.exists((ingredient) => matcherMatchesItem(ingredient.matcher, stack))
  )

export const matcherMatchesItem = (matcher: ItemMatcher, stack: CraftingItemStack): boolean =>
  Match.value(matcher).pipe(
    Match.tag('exact', ({ item }) => item.itemId === stack.itemId && item.quantity <= stack.quantity),
    Match.tag('tag', ({ tag, quantity }) => stack.metadata?.tags?.includes(tag) === true && stack.quantity >= quantity),
    Match.exhaustive
  )
