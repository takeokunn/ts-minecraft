import { Layer } from 'effect'
import { SessionManagerLive } from './application_service/session_manager'
import { SessionStoreLive } from './repository/session_store'

export const InteractionDomainLive = Layer.mergeAll(SessionStoreLive, SessionManagerLive)
