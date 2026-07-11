import { Option } from 'effect'
import { trapDialogFocus, visibleFocusableElements } from '../dom-focus-utils'

export const visiblePauseMenuControls = (
  controls: ReadonlyArray<Option.Option<HTMLElement>>,
): ReadonlyArray<HTMLElement> =>
  visibleFocusableElements(controls.map(Option.getOrNull))

export const trapPauseMenuFocus = (
  event: KeyboardEvent,
  focusableControls: ReadonlyArray<HTMLElement>,
  activeElement: Element | null,
): void => {
  trapDialogFocus(event, focusableControls, activeElement)
}
