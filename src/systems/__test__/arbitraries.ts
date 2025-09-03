import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { InputState, Target, Hotbar, Position } from '@/domain/components'
import { blockTypeNames } from '@/domain/block-types'
import * as fc from 'effect/FastCheck'
import { EntityId } from '@/domain/entity'

export const arbitraryInputState = Arbitrary.make(S.partial(InputState))
export const arbitraryTarget = Arbitrary.make(Target)
export const arbitraryHotbar = Arbitrary.make(Hotbar)
export const arbitraryPosition = Arbitrary.make(Position)

export const arbitraryBlockType = fc.constantFrom(...blockTypeNames)

export const arbitraryHotbarWithAir = fc.record({
  slots: fc.array(arbitraryBlockType),
  selectedIndex: fc.integer(),
}).map((hotbar) => {
  const selectedIndex = hotbar.selectedIndex % (hotbar.slots.length || 1)
  const slots = [...hotbar.slots]
  if (slots.length > 0) {
    slots[selectedIndex] = 'air'
  }
  return { ...hotbar, selectedIndex, slots }
})

export const arbitraryHotbarWithoutAir = fc.record({
  slots: fc.array(arbitraryBlockType.filter((b) => b !== 'air')),
  selectedIndex: fc.integer(),
}).map((hotbar) => {
  const selectedIndex = hotbar.selectedIndex % (hotbar.slots.length || 1)
  return { ...hotbar, selectedIndex }
})

export const arbitraryTargetBlock = fc.record({
  _tag: fc.constant('block' as const),
  entityId: fc.uuid().map(EntityId),
  position: arbitraryPosition,
  face: fc.tuple(fc.integer(), fc.integer(), fc.integer()),
})

export const arbitraryTargetNone = fc.record({
  _tag: fc.constant('none' as const),
})
