import { Duration, Effect, Option, Schedule, Stream, type Scope } from 'effect'

import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type {
  MultiplayerService,
  MultiplayerSessionState,
  RemotePlayerSnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'
import { installMultiplayerChatOverlay } from '@ts-minecraft/app/main/session-runtime-multiplayer-chat'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'
import { PlayerName } from '@ts-minecraft/network/domain/schemas'
import type { ChatPanel, ConnectionPanel, ConnectionRequest, PlayerListPanel } from '@ts-minecraft/presentation'

const CHAT_PANEL_SYNC_INTERVAL_MS = 500
const PLAYER_LIST_PANEL_SYNC_INTERVAL_MS = 500

const canUseChatPanel = (state: MultiplayerSessionState): boolean =>
  state === 'joining' || state === 'ready'

export type SessionRuntimeOverlayParams = {
  readonly rendering: Pick<SessionRuntimeParams['rendering'], 'camera' | 'scene'>
  readonly state: Pick<SessionRuntimeParams['state'], 'control' | 'respawnPositionRef'>
  readonly overlays: SessionRuntimeParams['overlays']
}

export type SessionRuntimeOverlayServices = Pick<
  FrameHandlerServices,
  | 'gameState'
  | 'playerCameraState'
  | 'blockHighlight'
  | 'inputService'
  | 'blockService'
  | 'hotbarService'
  | 'furnaceService'
  | 'inventoryService'
  | 'inventoryRenderer'
  | 'chunkManagerService'
  | 'timeService'
  | 'debugFeatureFlags'
  | 'pauseMenu'
  | 'worldRendererService'
  | 'entityManager'
  | 'fpsCounter'
  | 'multiplayer'
>

const normalizeConnectionRequest = (request: ConnectionRequest) => ({
  serverUrl: request.serverUrl.trim(),
  playerName: request.playerName.trim(),
})

export const connectFromConnectionPanel = (
  panel: ConnectionPanel,
  multiplayer: MultiplayerService,
  request: ConnectionRequest,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const { serverUrl, playerName } = normalizeConnectionRequest(request)

    if (serverUrl.length === 0 || playerName.length === 0) {
      yield* panel.setConnected(false)
      yield* panel.setStatus('Server URL and player name are required')
      return
    }

    yield* panel.setStatus(`Connecting to ${serverUrl}...`)
    yield* multiplayer.connect(serverUrl, PlayerName.make(playerName))

    const state = yield* multiplayer.getConnectionState()
    const connected = state === 'connected'

    yield* panel.setConnected(connected)
    yield* panel.setStatus(connected ? `Connected to ${serverUrl}` : `Connection failed (${state})`)
  })

export const disconnectFromConnectionPanel = (
  panel: ConnectionPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* panel.setStatus('Disconnecting...')
    yield* multiplayer.disconnect
    yield* panel.setConnected(false)
    yield* panel.setStatus('Disconnected')
  })

export const installMultiplayerConnectionPanel = (
  panel: ConnectionPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    yield* panel.show
    yield* Stream.runForEach(panel.onConnect, (request) =>
      connectFromConnectionPanel(panel, multiplayer, request),
    ).pipe(Effect.forkScoped)
    yield* Stream.runForEach(panel.onDisconnect, () =>
      disconnectFromConnectionPanel(panel, multiplayer),
    ).pipe(Effect.forkScoped)
  })

export const sendChatFromChatPanel = (
  multiplayer: MultiplayerService,
  text: string,
): Effect.Effect<void, never> => {
  const trimmed = text.trim()
  return trimmed.length === 0 ? Effect.void : multiplayer.sendChat(trimmed)
}

export const syncMultiplayerChatPanel = (
  panel: ChatPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const state = yield* multiplayer.getSessionState()
    yield* panel.setConnected(canUseChatPanel(state))
    const messages = yield* multiplayer.getChatMessages()
    yield* panel.setMessages(messages)
  })

export const syncMultiplayerPlayerListPanel = (
  panel: PlayerListPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const remotePlayers = yield* multiplayer.getRemotePlayers()
    const players: Array<RemotePlayerSnapshot> = []
    for (const player of remotePlayers.values()) {
      players.push(player)
    }
    yield* panel.setPlayers(players)
  })

export const installMultiplayerChatPanel = (
  panel: ChatPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    yield* panel.hide
    yield* syncMultiplayerChatPanel(panel, multiplayer)
    yield* Stream.runForEach(panel.onSend, (text) =>
      sendChatFromChatPanel(multiplayer, text),
    ).pipe(Effect.forkScoped)
    yield* syncMultiplayerChatPanel(panel, multiplayer).pipe(
      Effect.repeat(Schedule.spaced(Duration.millis(CHAT_PANEL_SYNC_INTERVAL_MS))),
      Effect.forkScoped,
    )
  })

export const installMultiplayerPlayerListPanel = (
  panel: PlayerListPanel,
  multiplayer: MultiplayerService,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    yield* panel.hide
    yield* syncMultiplayerPlayerListPanel(panel, multiplayer)
    yield* syncMultiplayerPlayerListPanel(panel, multiplayer).pipe(
      Effect.repeat(Schedule.spaced(Duration.millis(PLAYER_LIST_PANEL_SYNC_INTERVAL_MS))),
      Effect.forkScoped,
    )
  })

export const installSessionRuntimeOverlays = (
  params: SessionRuntimeOverlayParams,
  services: SessionRuntimeOverlayServices,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const {
      rendering: { camera, scene },
      state: { control, respawnPositionRef },
      overlays: {
        deathScreen,
        debugOverlay,
        chatPanel,
        connectionPanel,
        playerListPanel,
        biomeService,
        recipeService,
      },
    } = params

    const {
      gameState,
      playerCameraState,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      furnaceService,
      inventoryService,
      inventoryRenderer,
      chunkManagerService,
      timeService,
      debugFeatureFlags,
      multiplayer,
      pauseMenu,
      worldRendererService,
      entityManager,
      fpsCounter,
    } = services

    yield* installQaApi({
      camera,
      scene,
      playerCameraState,
      blockHighlight,
      inputService,
      inventoryService,
      inventoryRenderer,
      gameState,
      timeService,
      chunkManagerService,
      blockService,
      hotbarService,
      recipeService,
      furnaceService,
      worldRendererService,
      entityManager,
      debugFeatureFlags,
      ...(Option.isSome(multiplayer) ? { multiplayer: multiplayer.value } : {}),
    })

    yield* deathScreen.attach(control, respawnPositionRef)

    // FR-1.4: mount the in-session pause menu. Listens for ESC via the
    // frame-handler input stage (which calls `pauseMenu.openIfClosed(control)`)
    // and drives Resume / Settings / Save & Quit. Listeners + DOM are torn
    // down with the surrounding session scope on quit-to-title.
    yield* pauseMenu.attach(control)

    yield* installMultiplayerChatOverlay(chatPanel, multiplayer)

    // FR-1.5: mount the F3 debug overlay. Hidden by default; F3 toggles it.
    // The 4 Hz refresh daemon is forked into the session scope so it tears
    // down with quit-to-title.
    yield* debugOverlay.attach({
      biomeService,
      chunkManager: chunkManagerService,
      gameState,
      timeService,
      cameraState: playerCameraState,
      fpsCounter,
      debugFeatureFlags,
    })

    if (Option.isSome(services.multiplayer)) {
      yield* installMultiplayerConnectionPanel(connectionPanel, services.multiplayer.value)
      yield* installMultiplayerChatPanel(chatPanel, services.multiplayer.value)
      yield* installMultiplayerPlayerListPanel(playerListPanel, services.multiplayer.value)
    }
  })
