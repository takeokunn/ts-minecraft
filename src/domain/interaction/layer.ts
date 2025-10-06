import { Layer } from 'effect'
import { SessionManagerLive } from './application_service'
import { SessionStoreLive } from './repository'

export const InteractionDomainLive = Layer.mergeAll(SessionStoreLive, SessionManagerLive)
