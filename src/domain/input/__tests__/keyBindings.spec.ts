import { describe, expect, it } from '@effect/vitest'
import { Trigger, defaultBindings, makeBinding, resolveActions } from '../key-bindings'
import { ActionId, AxisId, AxisValue, InputTimestamp, KeyCode, type InputEvent } from '../model'

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

  it('axis bindings activate when thresholds are satisfied', () => {
    const axis = AxisId(2)
    const positive = makeBinding(ActionId('movePositive'), [
      Trigger.Axis({ axis, direction: 'positive', threshold: AxisValue(0.5) }),
    ])
    const negative = makeBinding(ActionId('moveNegative'), [
      Trigger.Axis({ axis, direction: 'negative', threshold: AxisValue(0.4) }),
    ])
    const registry = [positive, negative]

    const positiveEvent: InputEvent = {
      _tag: 'GamepadAxisChanged',
      axis,
      timestamp: InputTimestamp(10),
      value: AxisValue(0.75),
    }

    const negativeEvent: InputEvent = {
      _tag: 'GamepadAxisChanged',
      axis,
      timestamp: InputTimestamp(20),
      value: AxisValue(-0.6),
    }

    expect(resolveActions(positiveEvent, registry)).toContainEqual(ActionId('movePositive'))
    expect(resolveActions(negativeEvent, registry)).toContainEqual(ActionId('moveNegative'))

    const belowThreshold: InputEvent = {
      _tag: 'GamepadAxisChanged',
      axis,
      timestamp: InputTimestamp(30),
      value: AxisValue(0.3),
    }

    expect(resolveActions(belowThreshold, registry)).toHaveLength(0)
  })
})
