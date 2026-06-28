import { Effect, Option } from 'effect'

import { MultiplayerServiceImpl, type MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import { ClientServiceImpl } from '@ts-minecraft/network/application/client-service'
import { BrowserWebSocketClient } from '@ts-minecraft/network/infrastructure/browser-websocket-client'

export const buildDisabledMultiplayerBootstrapServices = Effect.succeed({
  multiplayerService: Option.none<MultiplayerService>(),
})

export const buildEnabledMultiplayerBootstrapServices = Effect.gen(function* () {
  const clientService = yield* ClientServiceImpl(new BrowserWebSocketClient())
  const multiplayerService = yield* MultiplayerServiceImpl(clientService)

  return {
    multiplayerService: Option.some(multiplayerService),
  }
})

export const buildMultiplayerBootstrapServices = buildEnabledMultiplayerBootstrapServices
