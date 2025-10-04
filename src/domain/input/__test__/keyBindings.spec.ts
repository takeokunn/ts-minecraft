import { describe, expect, it, prop } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
import { ActionId, AxisId, AxisValue, InputTimestamp, KeyCode, type InputEvent } from '../model'
import { Trigger, axisBinding, defaultBindings, makeBinding, resolveActions } from '../keyBindings'

describe('keyBindings', () => {
  it('matches configured key bindings', () => {
    const registry = [makeBinding(ActionId('jump'), [Trigger.Key({ key: KeyCode('Space') })])]
    const event: InputEvent = {
      _tag: 'KeyPressed',
      key: KeyCode('Space'),
      timestamp: InputTimestamp(1),
    }
    const result = resolveActions(event, registry)
    expect(result).toContainEqual(ActionId('jump'))
  })

  it('returns empty array for unmatched events', () => {
    const event: InputEvent = {
      _tag: 'KeyPressed',
      key: KeyCode('KeyZ'),
      timestamp: InputTimestamp(1),
    }
    const result = resolveActions(event, defaultBindings)
    expect(result).toHaveLength(0)
  })

  prop(
    'positive axis direction activates action when threshold satisfied',
    [FC.double({ min: -1, max: 1 })],
    ([valueSample]) => {
      const axis = AxisId(1)
      const threshold = AxisValue(0.3)
      const registry = [axisBinding('lookRight', axis, 'positive', threshold)]
      const event: InputEvent = {
        _tag: 'GamepadAxisChanged',
        axis,
        value: AxisValue(valueSample),
        timestamp: InputTimestamp(1),
      }
      const actions = resolveActions(event, registry)
      const triggered = actions.length > 0
      expect(triggered).toBe(valueSample >= threshold)
    }
  )
})
