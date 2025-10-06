import * as Layer from 'effect/Layer'

import { GameLoopService, GameLoopServiceLive } from './legacy'

export const GameLoopDomainLive: Layer.Layer<GameLoopService> = GameLoopServiceLive
