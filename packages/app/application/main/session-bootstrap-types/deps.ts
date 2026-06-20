import type { SessionBootstrapCoreDeps } from './core'
import type { SessionBootstrapServiceGroups } from './services'
import type { SessionBootstrapPresentationDeps } from './presentation/deps'

export type SessionBootstrapDeps = SessionBootstrapCoreDeps &
  SessionBootstrapPresentationDeps & {
    readonly services: SessionBootstrapServiceGroups
  }
