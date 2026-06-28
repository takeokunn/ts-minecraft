import { Effect } from 'effect'

import type {
  AutoSaveStatus,
  AutoSaveStatusReporter,
} from '@ts-minecraft/app/main/session-autosave'

const AUTO_SAVE_STATUS_TEXT: Record<AutoSaveStatus, string> = {
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
}

const AUTO_SAVE_STATUS_LABEL: Record<AutoSaveStatus, string> = {
  saving: 'Saving world changes',
  saved: 'World changes saved',
  error: 'Save failed. Use Save & Quit before leaving.',
}

const AUTO_SAVE_STATUS_LIVE_REGION: Record<AutoSaveStatus, 'polite' | 'assertive'> = {
  saving: 'polite',
  saved: 'polite',
  error: 'assertive',
}

const setStatusAttribute = (element: HTMLElement, name: string, value: string): void => {
  const setAttribute = (element as { readonly setAttribute?: HTMLElement['setAttribute'] }).setAttribute
  if (typeof setAttribute === 'function') {
    setAttribute.call(element, name, value)
  }
}

const setStatusDataset = (element: HTMLElement, status: AutoSaveStatus): void => {
  const dataset = (element as { readonly dataset?: DOMStringMap }).dataset
  if (dataset !== undefined) {
    dataset['saveStatus'] = status
    return
  }

  setStatusAttribute(element, 'data-save-status', status)
}

export const createDomAutoSaveStatusReporter =
  (element: HTMLElement | null): AutoSaveStatusReporter =>
  (status) =>
    Effect.sync(() => {
      if (element === null) {
        return
      }

      element.textContent = AUTO_SAVE_STATUS_TEXT[status]
      setStatusDataset(element, status)
      element.title = AUTO_SAVE_STATUS_LABEL[status]
      setStatusAttribute(element, 'role', 'status')
      setStatusAttribute(element, 'aria-live', AUTO_SAVE_STATUS_LIVE_REGION[status])
      setStatusAttribute(element, 'aria-atomic', 'true')
      setStatusAttribute(element, 'aria-label', AUTO_SAVE_STATUS_LABEL[status])
    })
