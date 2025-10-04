import { it, expect } from '@effect/vitest'
import * as Materials from '../index'

it('barrel exports live layer and helper utilities', () => {
  expect(Materials.MaterialServiceLayer).toBeDefined()
  expect(Materials.getToolHarvestLevel).toBeInstanceOf(Function)
})
