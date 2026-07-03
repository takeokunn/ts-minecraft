import { Either, Schema } from 'effect'
import { Recipe } from './crafting'

// Data-driven custom recipes — the first modding surface. Players drop a JSON
// array of Recipe objects into localStorage under this key and the recipe
// book picks them up at boot. Each entry is decoded with the SAME schema the
// built-in recipes use, so invalid item types, counts outside 1-64, or
// unknown stations are rejected per-entry (one bad recipe never poisons the
// pack).
export const CUSTOM_RECIPES_STORAGE_KEY = 'ts-minecraft:custom-recipes'

export type CustomRecipeLoadResult = {
  readonly recipes: ReadonlyArray<Recipe>
  readonly errors: ReadonlyArray<string>
}

const decodeRecipe = Schema.decodeUnknownEither(Recipe)

// Decode a raw JSON value (expected: an array of recipe objects) into
// validated recipes, collecting a human-readable error per rejected entry.
export const decodeCustomRecipes = (raw: unknown): CustomRecipeLoadResult => {
  if (!Array.isArray(raw)) {
    return { recipes: [], errors: ['custom recipes must be a JSON array of recipe objects'] }
  }
  const recipes: Array<Recipe> = []
  const errors: Array<string> = []
  raw.forEach((entry, index) => {
    const decoded = decodeRecipe(entry)
    if (Either.isRight(decoded)) {
      recipes.push(decoded.right)
    } else {
      errors.push(`custom recipe [${index}] rejected: ${String(decoded.left.message).slice(0, 200)}`)
    }
  })
  return { recipes, errors }
}

// Merge custom recipes after the built-ins, skipping id collisions — a
// custom pack must never silently replace core progression recipes.
export const mergeCustomRecipes = (
  builtins: ReadonlyArray<Recipe>,
  custom: ReadonlyArray<Recipe>,
): { readonly recipes: ReadonlyArray<Recipe>; readonly skippedIds: ReadonlyArray<string> } => {
  const knownIds = new Set<string>(builtins.map((recipe) => String(recipe.id)))
  const merged: Array<Recipe> = [...builtins]
  const skippedIds: Array<string> = []
  for (const recipe of custom) {
    const id = String(recipe.id)
    if (knownIds.has(id)) {
      skippedIds.push(id)
      continue
    }
    knownIds.add(id)
    merged.push(recipe)
  }
  return { recipes: merged, skippedIds }
}

// Boot-time storage read; safe in workers/tests (no window) and on malformed
// JSON — every failure path degrades to "no custom recipes".
export const loadCustomRecipesFromStorage = (): CustomRecipeLoadResult => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return { recipes: [], errors: [] }
  }
  const raw = window.localStorage.getItem(CUSTOM_RECIPES_STORAGE_KEY)
  if (raw === null || raw.trim() === '') return { recipes: [], errors: [] }
  try {
    return decodeCustomRecipes(JSON.parse(raw))
  } catch {
    return { recipes: [], errors: [`custom recipes: invalid JSON under localStorage['${CUSTOM_RECIPES_STORAGE_KEY}']`] }
  }
}
