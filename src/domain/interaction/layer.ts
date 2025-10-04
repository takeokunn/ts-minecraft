import { Layer } from 'effect'
import { SessionManagerLive } from './application_service/session-manager'
import { SessionStoreLive } from './repository/session-store'

export const InteractionDomainLive = Layer.mergeAll(SessionStoreLive, SessionManagerLive)
