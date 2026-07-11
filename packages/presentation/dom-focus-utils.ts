export const asFocusableElement = (element: Element | null | undefined): HTMLElement | null => {
  const candidate = element as (HTMLElement & { readonly focus?: unknown }) | null | undefined
  return typeof candidate?.focus === 'function' ? candidate : null
}

export const getActiveDocument = (): Partial<Document> | null =>
  typeof document === 'undefined' ? null : document

export const currentActiveElement = (): HTMLElement | null =>
  asFocusableElement(getActiveDocument()?.activeElement)

export const restoreFocusIfConnected = (element: Element | null | undefined): void => {
  const focusable = asFocusableElement(element)
  if (focusable !== null && focusable.isConnected !== false) focusable.focus()
}

type FocusableControl = HTMLElement & {
  readonly disabled?: boolean
}

export const visibleFocusableElements = (
  elements: ReadonlyArray<Element | null | undefined>,
): ReadonlyArray<HTMLElement> =>
  elements.flatMap((element) => {
    const focusable = asFocusableElement(element) as FocusableControl | null
    if (focusable === null || focusable.disabled === true) return []
    if (focusable.style.display === 'none' || focusable.style.visibility === 'hidden') return []
    return [focusable]
  })

export const trapDialogFocus = (
  event: Pick<KeyboardEvent, 'preventDefault' | 'shiftKey'>,
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
