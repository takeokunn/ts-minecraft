import { Match, pipe } from 'effect'
import { ActionId, AxisId, AxisValue, KeyCode, MouseButton } from './model'
import type { InputEvent } from './model'

type AxisDirection = 'positive' | 'negative'

export type Trigger =
  | { readonly _tag: 'Key'; readonly key: KeyCode }
  | { readonly _tag: 'Mouse'; readonly button: MouseButton }
  | { readonly _tag: 'Axis'; readonly axis: AxisId; readonly direction: AxisDirection; readonly threshold: AxisValue }

export const Trigger = {
  Key: (params: { key: KeyCode }): Trigger => ({ _tag: 'Key', key: params.key }),
  Mouse: (params: { button: MouseButton }): Trigger => ({ _tag: 'Mouse', button: params.button }),
  Axis: (params: { axis: AxisId; direction: AxisDirection; threshold: AxisValue }): Trigger => ({
    _tag: 'Axis',
    axis: params.axis,
    direction: params.direction,
    threshold: params.threshold,
  }),
}

export interface Binding {
  readonly action: ActionId
  readonly triggers: ReadonlyArray<Trigger>
}

export type BindingRegistry = ReadonlyArray<Binding>

export const makeBinding = (action: ActionId, triggers: ReadonlyArray<Trigger>): Binding => ({
  action,
  triggers,
})

const matchesKey = (trigger: Trigger, event: InputEvent): boolean =>
  pipe(
    trigger,
    Match.value,
    Match.when({ _tag: 'Key' }, ({ key }) =>
      pipe(
        event,
        Match.value,
        Match.tag('KeyPressed', (keyEvent) => keyEvent.key === key),
        Match.tag('KeyReleased', (keyEvent) => keyEvent.key === key),
        Match.orElse(() => false)
      )
    ),
    Match.orElse(() => false)
  )

const matchesMouse = (trigger: Trigger, event: InputEvent): boolean =>
  pipe(
    trigger,
    Match.value,
    Match.when({ _tag: 'Mouse' }, ({ button }) =>
      pipe(
        event,
        Match.value,
        Match.tag('MouseButtonPressed', (mouseEvent) => mouseEvent.button === button),
        Match.tag('MouseButtonReleased', (mouseEvent) => mouseEvent.button === button),
        Match.orElse(() => false)
      )
    ),
    Match.orElse(() => false)
  )

const matchesAxis = (trigger: Trigger, event: InputEvent): boolean =>
  pipe(
    trigger,
    Match.value,
    Match.when({ _tag: 'Axis' }, ({ axis, direction, threshold }) =>
      pipe(
        event,
        Match.value,
        Match.tag('GamepadAxisChanged', (axisEvent) =>
          pipe(
            axisEvent.axis === axis,
            Match.value,
            Match.when(true, () =>
              pipe(
                direction,
                Match.value,
                Match.when('positive', () => axisEvent.value >= threshold),
                Match.when('negative', () => axisEvent.value <= -threshold),
                Match.orElse(() => false)
              )
            ),
            Match.orElse(() => false)
          )
        ),
        Match.orElse(() => false)
      )
    ),
    Match.orElse(() => false)
  )

const matchesTrigger = (trigger: Trigger, event: InputEvent): boolean =>
  pipe(
    trigger._tag,
    Match.value,
    Match.when('Key', () => matchesKey(trigger, event)),
    Match.when('Mouse', () => matchesMouse(trigger, event)),
    Match.when('Axis', () => matchesAxis(trigger, event)),
    Match.exhaustive
  )

export const resolveActions = (event: InputEvent, registry: BindingRegistry): ReadonlyArray<ActionId> =>
  registry
    .filter((binding) => binding.triggers.some((trigger) => matchesTrigger(trigger, event)))
    .map((binding) => binding.action)

export const simpleKeyBinding = (action: string, key: string): Binding =>
  makeBinding(ActionId(action), [Trigger.Key({ key: KeyCode(key) })])

export const mouseBinding = (action: string, button: 'left' | 'middle' | 'right'): Binding =>
  makeBinding(ActionId(action), [Trigger.Mouse({ button: MouseButton(button) })])

export const axisBinding = (action: string, axis: number, direction: AxisDirection, threshold: number): Binding =>
  makeBinding(ActionId(action), [
    Trigger.Axis({
      axis: AxisId(axis),
      direction,
      threshold: AxisValue(threshold),
    }),
  ])

export const defaultBindings: BindingRegistry = [
  simpleKeyBinding('moveForward', 'KeyW'),
  simpleKeyBinding('moveBackward', 'KeyS'),
  simpleKeyBinding('moveLeft', 'KeyA'),
  simpleKeyBinding('moveRight', 'KeyD'),
  simpleKeyBinding('jump', 'Space'),
  mouseBinding('attack', 'left'),
  mouseBinding('interact', 'right'),
  axisBinding('lookUp', 3, 'negative', 0.25),
  axisBinding('lookDown', 3, 'positive', 0.25),
  axisBinding('lookLeft', 2, 'negative', 0.25),
  axisBinding('lookRight', 2, 'positive', 0.25),
]
