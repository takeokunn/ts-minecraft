import * as Layer from 'effect/Layer'

import { GameLoopServiceLive } from './legacy/live'
import { GameLoopService } from './legacy/service'

export const GameLoopDomainLive: Layer.Layer<GameLoopService> = GameLoopServiceLive
