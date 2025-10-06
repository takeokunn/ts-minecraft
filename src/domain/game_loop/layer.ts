import * as Layer from 'effect/Layer'

import { GameLoopServiceLive } from './legacy'
import { GameLoopService } from './legacy'

export const GameLoopDomainLive: Layer.Layer<GameLoopService> = GameLoopServiceLive
