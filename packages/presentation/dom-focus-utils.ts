export const asFocusableElement = (element: Element | null | undefined): HTMLElement | null => {
  const candidate = element as (HTMLElement & { readonly focus?: unknown }) | null | undefined
  return typeof candidate?.focus === 'function' ? candidate : null
}

export const getActiveDocument = (): Partial<Document> | null =>
  typeof document === 'undefined' ? null : document

export const currentActiveElement = (): HTMLElement | null =>
  asFocusableElement(getActiveDocument()?.activeElement)
