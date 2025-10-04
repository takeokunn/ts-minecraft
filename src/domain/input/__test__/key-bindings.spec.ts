import { describe, expect, it } from '@effect/vitest'
import { ActionId, AxisId, AxisValue, InputTimestamp, KeyCode, type InputEvent } from '../model'
import { Trigger, axisBinding, defaultBindings, makeBinding, resolveActions } from '../key-bindings'

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

  it('positive axis direction activates action when threshold satisfied', () => {
    const axisIndex = 2
    const threshold = 0.35
    const registry = [axisBinding('lookRight', axisIndex, 'positive', threshold)]

    const makeAxisEvent = (value: number): InputEvent => ({
      _tag: 'GamepadAxisChanged',
      axis: AxisId(axisIndex),
      value: AxisValue(value),
      timestamp: InputTimestamp(10),
    })

    const activated = resolveActions(makeAxisEvent(0.5), registry)
    expect(activated).toContainEqual(ActionId('lookRight'))

    const boundary = resolveActions(makeAxisEvent(threshold), registry)
    expect(boundary).toContainEqual(ActionId('lookRight'))

    const suppressed = resolveActions(makeAxisEvent(0.2), registry)
    expect(suppressed).not.toContainEqual(ActionId('lookRight'))
  })
})
