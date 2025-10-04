import { expect, it } from '@effect/vitest'
import { HashMap, HashSet, pipe } from 'effect'
import * as Array_ from 'effect/Array'
import { burnTimeByItemId, materialByBlockId, materialCatalog, toolEfficiencyByKey } from '../catalog'

it('materialCatalog is non-empty and every material is indexed by block id', () => {
  expect(materialCatalog.length).toBeGreaterThan(0)
  const allIndexed = pipe(
    materialCatalog,
    Array_.every((material) => HashMap.has(materialByBlockId, material.blockId))
  )
  expect(allIndexed).toBe(true)
})

it('block identifiers are unique across the catalog', () => {
  const blockIds = pipe(
    materialCatalog,
    Array_.reduce(HashSet.empty<(typeof materialCatalog)[number]['blockId']>(), (set, material) =>
      HashSet.add(set, material.blockId)
    )
  )
  expect(HashSet.size(blockIds)).toBe(materialCatalog.length)
})

it('burnable materials provide burn time entries', () => {
  const burnable = pipe(
    materialCatalog,
    Array_.filter((material) => material.burnTime !== undefined)
  )
  const allRegistered = pipe(
    burnable,
    Array_.every((material) => HashMap.has(burnTimeByItemId, material.defaultItemId))
  )
  expect(allRegistered).toBe(true)
})

it('tool efficiency matrix entries are available', () => {
  expect(HashMap.size(toolEfficiencyByKey)).toBeGreaterThan(0)
})
