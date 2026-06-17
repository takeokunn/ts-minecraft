export type { SessionRenderingBootstrapServices } from './rendering'
export type { SessionWorldBootstrapServices } from './world'
export type { SessionGameBootstrapServices, SessionBootstrapGameplayDeps } from './game'
export type { SessionPresentationBootstrapServices, SessionBootstrapPresentationDeps } from './presentation'
export type { SessionInventoryBootstrapServices } from './inventory'
export type { SessionEntityBootstrapServices } from './entity'

export type SessionBootstrapServices =
  import('./rendering').SessionRenderingBootstrapServices &
  import('./world').SessionWorldBootstrapServices &
  import('./game').SessionGameBootstrapServices &
  import('./presentation').SessionPresentationBootstrapServices &
  import('./inventory').SessionInventoryBootstrapServices &
  import('./entity').SessionEntityBootstrapServices
