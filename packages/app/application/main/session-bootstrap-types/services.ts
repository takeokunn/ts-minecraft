export type SessionBootstrapServiceGroups = {
  readonly rendering: import('./rendering').SessionRenderingBootstrapServices
  readonly world: import('./world').SessionWorldBootstrapServices
  readonly gameplay: import('./game').SessionGameBootstrapServices
  readonly presentation: import('./presentation/services').SessionPresentationBootstrapServices
  readonly inventory: import('./inventory').SessionInventoryBootstrapServices
  readonly entity: import('./entity').SessionEntityBootstrapServices
}

export type SessionBootstrapServices =
  import('./rendering').SessionRenderingBootstrapServices &
  import('./world').SessionWorldBootstrapServices &
  import('./game').SessionGameBootstrapServices &
  import('./presentation/services').SessionPresentationBootstrapServices &
  import('./inventory').SessionInventoryBootstrapServices &
  import('./entity').SessionEntityBootstrapServices
