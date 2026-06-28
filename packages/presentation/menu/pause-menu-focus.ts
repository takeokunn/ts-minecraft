import { Option } from 'effect'

type FocusableControl = HTMLElement & {
  readonly disabled?: boolean
}

export const visiblePauseMenuControls = (
  controls: ReadonlyArray<Option.Option<HTMLElement>>,
): ReadonlyArray<HTMLElement> =>
  controls.flatMap((control) => {
    const element = Option.getOrNull(control) as FocusableControl | null
    if (element === null) return []
    if (element.disabled === true) return []
    if (element.style.display === 'none' || element.style.visibility === 'hidden') return []
    return [element]
  })

export const trapPauseMenuFocus = (
  event: KeyboardEvent,
  focusableControls: ReadonlyArray<HTMLElement>,
  activeElement: Element | null,
): void => {
  const first = focusableControls[0]
  const last = focusableControls[focusableControls.length - 1]
  if (first === undefined || last === undefined) return

  const activeIndex = focusableControls.findIndex((element) => element === activeElement)
  if (activeIndex === -1) {
    event.preventDefault()
    first.focus()
    return
  }

  if (event.shiftKey && activeIndex === 0) {
    event.preventDefault()
    last.focus()
    return
  }

  if (!event.shiftKey && activeIndex === focusableControls.length - 1) {
    event.preventDefault()
    first.focus()
  }
}
