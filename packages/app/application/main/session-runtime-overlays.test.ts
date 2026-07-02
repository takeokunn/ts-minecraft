import { Effect, MutableRef, Option, Queue, Stream } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  installQaApi: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/qa-api', () => ({
  installQaApi: mocks.installQaApi,
}))

import {
  connectFromConnectionPanel,
  disconnectFromConnectionPanel,
  installSessionRuntimeOverlays,
  sendChatFromChatPanel,
  syncMultiplayerChatPanel,
  syncMultiplayerPlayerListPanel,
  type SessionRuntimeOverlayParams,
  type SessionRuntimeOverlayServices,
} from '@ts-minecraft/app/main/session-runtime-overlays'
import type {
  ChatEntry,
  MultiplayerService,
  MultiplayerSessionState,
  RemotePlayerSnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { ChatPanel, ConnectionPanel, PlayerListPanel } from '@ts-minecraft/presentation'

const makeConnectionPanel = () => {
  const statuses: string[] = []
  const connectedStates: boolean[] = []
  const show = vi.fn()
  const hide = vi.fn()
  const panel = {
    element: {} as HTMLElement,
    setStatus: vi.fn((status: string) =>
      Effect.sync(() => {
        statuses.push(status)
      }),
    ),
    onConnect: Stream.empty,
    onDisconnect: Stream.empty,
    show: Effect.sync(() => {
      show()
    }),
    hide: Effect.sync(() => {
      hide()
    }),
    setConnected: vi.fn((connected: boolean) =>
      Effect.sync(() => {
        connectedStates.push(connected)
      }),
    ),
  } satisfies ConnectionPanel

  return { panel, statuses, connectedStates, show, hide }
}

const makeChatPanel = (
  options: { readonly onSend?: Stream.Stream<string, never, never> } = {},
) => {
  const connectedStates: boolean[] = []
  const messageSnapshots: ReadonlyArray<ChatEntry>[] = []
  const show = vi.fn()
  const hide = vi.fn()
  const panel = {
    element: {} as HTMLElement,
    onSend: options.onSend ?? Stream.empty,
    show: Effect.sync(() => {
      show()
    }),
    hide: Effect.sync(() => {
      hide()
    }),
    setConnected: vi.fn((connected: boolean) =>
      Effect.sync(() => {
        connectedStates.push(connected)
      }),
    ),
    setMessages: vi.fn((messages: ReadonlyArray<ChatEntry>) =>
      Effect.sync(() => {
        messageSnapshots.push(messages)
      }),
    ),
  } satisfies ChatPanel

  return { panel, connectedStates, messageSnapshots, show, hide }
}

const makePlayerListPanel = () => {
  const playersSnapshots: ReadonlyArray<RemotePlayerSnapshot>[] = []
  const show = vi.fn()
  const hide = vi.fn()
  const panel = {
    element: {} as HTMLElement,
    show: Effect.sync(() => {
      show()
    }),
    hide: Effect.sync(() => {
      hide()
    }),
    isOpen: () => Effect.succeed(false),
    setPlayers: vi.fn((players: ReadonlyArray<RemotePlayerSnapshot>) =>
      Effect.sync(() => {
        playersSnapshots.push(players)
      }),
    ),
  } satisfies PlayerListPanel

  return { panel, playersSnapshots, show, hide }
}

type MultiplayerState = 'disconnected' | 'connecting' | 'connected'

const defaultSessionState = (state: MultiplayerState): MultiplayerSessionState =>
  state === 'connected' ? 'ready' : state

const makeMultiplayer = (
  state: MultiplayerState = 'connected',
  chatMessages: ReadonlyArray<ChatEntry> = [],
  sessionState: MultiplayerSessionState = defaultSessionState(state),
  remotePlayers: ReadonlyMap<string, RemotePlayerSnapshot> = new Map(),
) => {
  const disconnectSpy = vi.fn()
  const multiplayer = {
    connect: vi.fn(() => Effect.void),
    disconnect: Effect.sync(() => {
      disconnectSpy()
    }),
    getConnectionState: vi.fn(() => Effect.succeed(state)),
    setLocalWorldSeed: vi.fn(() => Effect.void),
    getWorldSeedInfo: vi.fn(() => Effect.succeed({ local: null, host: null })),
    getSessionState: vi.fn(() => Effect.succeed(sessionState)),
    getRemotePlayers: vi.fn(() => Effect.succeed(remotePlayers)),
    getChatMessages: vi.fn(() => Effect.succeed(chatMessages)),
    sendChat: vi.fn(() => Effect.void),
    sendPositionUpdate: vi.fn(() => Effect.void),
    sendBlockPlace: vi.fn(() => Effect.void),
    sendBlockBreak: vi.fn(() => Effect.void),
    sendEntitySnapshot: vi.fn(() => Effect.void),
    drainBlockEdits: Effect.succeed([]),
    drainEntitySnapshots: Effect.succeed([]),
    drainInbound: Effect.void,
  } satisfies MultiplayerService

  return { multiplayer, disconnectSpy }
}

describe('installSessionRuntimeOverlays', () => {
  it('installs the QA API and mounts the per-session overlays', async () => {
    const respawnPositionRef = MutableRef.make({ x: 1, y: 2, z: 3 })
    const control = { tag: 'control' } as never
    const deathScreen = {
      attach: vi.fn(() => Effect.void),
    }
    const pauseMenu = {
      attach: vi.fn(() => Effect.void),
      isOpen: vi.fn(() => Effect.succeed(false)),
    }
    const debugOverlay = {
      attach: vi.fn(() => Effect.void),
    }
    const connectionPanelFixture = makeConnectionPanel()
    const chatPanelFixture = makeChatPanel()
    const playerListPanelFixture = makePlayerListPanel()
    const biomeService = { tag: 'biome-service' } as never
    const recipeService = { tag: 'recipe-service' } as never
    const gameState = { tag: 'game-state' } as never
    const playerCameraState = { tag: 'player-camera-state' } as never
    const blockHighlight = { tag: 'block-highlight' } as never
    const inputService = { tag: 'input-service' } as never
    const blockService = { tag: 'block-service' } as never
    const hotbarService = { tag: 'hotbar-service' } as never
    const furnaceService = { tag: 'furnace-service' } as never
    const inventoryService = { tag: 'inventory-service' } as never
    const inventoryRenderer = { tag: 'inventory-renderer' } as never
    const chunkManagerService = { tag: 'chunk-manager-service' } as never
    const timeService = { tag: 'time-service' } as never
    const debugFeatureFlags = { tag: 'debug-feature-flags' } as never
    const fpsCounter = { tag: 'fps-counter' } as never
    const params = {
      rendering: {
        camera: { tag: 'camera' } as never,
        scene: { tag: 'scene' } as never,
      },
      state: {
        control,
        respawnPositionRef,
      },
      overlays: {
        deathScreen,
        debugOverlay,
        connectionPanel: connectionPanelFixture.panel,
        chatPanel: chatPanelFixture.panel,
        playerListPanel: playerListPanelFixture.panel,
        biomeService,
        recipeService,
      },
    } satisfies SessionRuntimeOverlayParams
    const services = {
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
      pauseMenu,
      worldRendererService: { tag: 'world-renderer-service' } as never,
      entityManager: { tag: 'entity-manager' } as never,
      fpsCounter,
      multiplayer: Option.none(),
    } satisfies SessionRuntimeOverlayServices

    mocks.installQaApi.mockReturnValue(Effect.void)

    await Effect.runPromise(Effect.scoped(installSessionRuntimeOverlays(params, services)))

    expect(mocks.installQaApi).toHaveBeenCalledOnce()
    expect(mocks.installQaApi).toHaveBeenCalledWith({
      camera: params.rendering.camera,
      scene: params.rendering.scene,
      playerCameraState,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      furnaceService,
      inventoryService,
      inventoryRenderer,
      gameState,
      timeService,
      chunkManagerService,
      recipeService,
      worldRendererService: services.worldRendererService,
      entityManager: services.entityManager,
      debugFeatureFlags,
    })
    expect(deathScreen.attach).toHaveBeenCalledOnce()
    expect(deathScreen.attach).toHaveBeenCalledWith(control, respawnPositionRef)
    expect(pauseMenu.attach).toHaveBeenCalledOnce()
    expect(pauseMenu.attach).toHaveBeenCalledWith(control)
    expect(debugOverlay.attach).toHaveBeenCalledOnce()
    expect(debugOverlay.attach).toHaveBeenCalledWith({
      biomeService,
      chunkManager: chunkManagerService,
      gameState,
      timeService,
      cameraState: playerCameraState,
      fpsCounter,
      debugFeatureFlags,
    })
    expect(connectionPanelFixture.show).not.toHaveBeenCalled()
    expect(chatPanelFixture.show).not.toHaveBeenCalled()
    expect(chatPanelFixture.hide).not.toHaveBeenCalled()
  })

  it('mounts multiplayer overlays, drains chat sends, and stops the chat stream on scope close', async () => {
    const sendQueue = await Effect.runPromise(Queue.unbounded<string>())
    const finalized = vi.fn()
    const onSend = Stream.fromQueue(sendQueue).pipe(
      Stream.ensuring(Effect.sync(() => {
        finalized()
      })),
    )
    const messages: ReadonlyArray<ChatEntry> = [{ player: 'Alex', text: 'hi', timestamp: 1 }]
    const respawnPositionRef = MutableRef.make({ x: 1, y: 2, z: 3 })
    const control = { tag: 'control' } as never
    const deathScreen = {
      attach: vi.fn(() => Effect.void),
    }
    const pauseMenu = {
      attach: vi.fn(() => Effect.void),
      isOpen: vi.fn(() => Effect.succeed(false)),
    }
    const debugOverlay = {
      attach: vi.fn(() => Effect.void),
    }
    const connectionPanelFixture = makeConnectionPanel()
    const chatPanelFixture = makeChatPanel({ onSend })
    const playerListPanelFixture = makePlayerListPanel()
    const biomeService = { tag: 'biome-service' } as never
    const recipeService = { tag: 'recipe-service' } as never
    const gameState = { tag: 'game-state' } as never
    const playerCameraState = { tag: 'player-camera-state' } as never
    const blockHighlight = { tag: 'block-highlight' } as never
    const inputService = { tag: 'input-service' } as never
    const blockService = { tag: 'block-service' } as never
    const hotbarService = { tag: 'hotbar-service' } as never
    const furnaceService = { tag: 'furnace-service' } as never
    const inventoryService = { tag: 'inventory-service' } as never
    const inventoryRenderer = { tag: 'inventory-renderer' } as never
    const chunkManagerService = { tag: 'chunk-manager-service' } as never
    const timeService = { tag: 'time-service' } as never
    const debugFeatureFlags = { tag: 'debug-feature-flags' } as never
    const fpsCounter = { tag: 'fps-counter' } as never
    const { multiplayer } = makeMultiplayer('connected', messages)
    const params = {
      rendering: {
        camera: { tag: 'camera' } as never,
        scene: { tag: 'scene' } as never,
      },
      state: {
        control,
        respawnPositionRef,
      },
      overlays: {
        deathScreen,
        debugOverlay,
        connectionPanel: connectionPanelFixture.panel,
        chatPanel: chatPanelFixture.panel,
        playerListPanel: playerListPanelFixture.panel,
        biomeService,
        recipeService,
      },
    } satisfies SessionRuntimeOverlayParams
    const services = {
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
      pauseMenu,
      worldRendererService: { tag: 'world-renderer-service' } as never,
      entityManager: { tag: 'entity-manager' } as never,
      fpsCounter,
      multiplayer: Option.some(multiplayer),
    } satisfies SessionRuntimeOverlayServices

    mocks.installQaApi.mockReturnValue(Effect.void)

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSessionRuntimeOverlays(params, services)
          yield* Queue.offer(sendQueue, ' hello from overlay ')
          yield* Effect.sleep(10)
        }),
      ),
    )

    expect(connectionPanelFixture.show).not.toHaveBeenCalled()
    expect(connectionPanelFixture.hide).toHaveBeenCalledOnce()
    expect(chatPanelFixture.show).not.toHaveBeenCalled()
    expect(chatPanelFixture.hide).toHaveBeenCalledOnce()
    expect(playerListPanelFixture.hide).toHaveBeenCalledOnce()
    expect(multiplayer.sendChat).toHaveBeenCalledWith('hello from overlay')
    expect(chatPanelFixture.connectedStates[0]).toBe(true)
    expect(chatPanelFixture.messageSnapshots[0]).toEqual(messages)
    expect(finalized).toHaveBeenCalledOnce()
  })

  it('connects from connection panel input and reflects successful state', async () => {
    const panelFixture = makeConnectionPanel()
    const { multiplayer } = makeMultiplayer('connected')

    await Effect.runPromise(
      connectFromConnectionPanel(panelFixture.panel, multiplayer, {
        serverUrl: ' ws://localhost:8080 ',
        playerName: ' Alex ',
      }),
    )

    expect(multiplayer.connect).toHaveBeenCalledWith('ws://localhost:8080', 'Alex')
    expect(multiplayer.getConnectionState).toHaveBeenCalledOnce()
    expect(panelFixture.connectedStates).toEqual([true])
    expect(panelFixture.statuses).toEqual([
      'Connecting to ws://localhost:8080...',
      'Connected to ws://localhost:8080',
    ])
  })

  it('rejects empty connection panel input without opening a websocket', async () => {
    const panelFixture = makeConnectionPanel()
    const { multiplayer } = makeMultiplayer()

    await Effect.runPromise(
      connectFromConnectionPanel(panelFixture.panel, multiplayer, {
        serverUrl: '   ',
        playerName: 'Alex',
      }),
    )

    expect(multiplayer.connect).not.toHaveBeenCalled()
    expect(panelFixture.connectedStates).toEqual([false])
    expect(panelFixture.statuses).toEqual(['Server URL and player name are required'])
  })

  it('disconnects from the connection panel and resets status', async () => {
    const panelFixture = makeConnectionPanel()
    const { disconnectSpy, multiplayer } = makeMultiplayer()

    await Effect.runPromise(disconnectFromConnectionPanel(panelFixture.panel, multiplayer))

    expect(disconnectSpy).toHaveBeenCalledOnce()
    expect(panelFixture.connectedStates).toEqual([false])
    expect(panelFixture.statuses).toEqual(['Disconnecting...', 'Disconnected'])
  })

  it('sends trimmed chat panel input through multiplayer service', async () => {
    const { multiplayer } = makeMultiplayer()

    await Effect.runPromise(sendChatFromChatPanel(multiplayer, ' hello world '))

    expect(multiplayer.sendChat).toHaveBeenCalledWith('hello world')
  })

  it('ignores blank chat panel input', async () => {
    const { multiplayer } = makeMultiplayer()

    await Effect.runPromise(sendChatFromChatPanel(multiplayer, '   '))

    expect(multiplayer.sendChat).not.toHaveBeenCalled()
  })

  it('syncs chat panel connection state and message snapshot', async () => {
    const chatPanelFixture = makeChatPanel()
    const messages: ReadonlyArray<ChatEntry> = [{ player: 'player-1', text: 'hello', timestamp: 1 }]
    const { multiplayer } = makeMultiplayer('connected', messages)

    await Effect.runPromise(syncMultiplayerChatPanel(chatPanelFixture.panel, multiplayer))

    expect(multiplayer.getSessionState).toHaveBeenCalledOnce()
    expect(chatPanelFixture.connectedStates).toEqual([true])
    expect(chatPanelFixture.messageSnapshots).toEqual([messages])
  })

  it('keeps chat panel enabled while connected session is still joining', async () => {
    const chatPanelFixture = makeChatPanel()
    const { multiplayer } = makeMultiplayer('connected', [], 'joining')

    await Effect.runPromise(syncMultiplayerChatPanel(chatPanelFixture.panel, multiplayer))

    expect(chatPanelFixture.connectedStates).toEqual([true])
    expect(chatPanelFixture.messageSnapshots).toEqual([[]])
  })

  it('disables the chat panel for sessions that are not connected', async () => {
    for (const sessionState of ['disconnected', 'connecting'] as const) {
      const chatPanelFixture = makeChatPanel()
      const { multiplayer } = makeMultiplayer(sessionState)

      await Effect.runPromise(syncMultiplayerChatPanel(chatPanelFixture.panel, multiplayer))

      expect(chatPanelFixture.connectedStates).toEqual([false])
      expect(chatPanelFixture.messageSnapshots).toEqual([[]])
    }
  })

  it('syncs player list panel with remote player snapshots', async () => {
    const playerListPanelFixture = makePlayerListPanel()
    const remotePlayers = new Map<string, RemotePlayerSnapshot>([
      [
        'player-1',
        {
          playerId: 'player-1',
          playerName: 'Alex',
          x: 1.25,
          y: 64,
          z: -2.5,
          yaw: 90,
          pitch: 0,
        },
      ],
    ])
    const { multiplayer } = makeMultiplayer('connected', [], 'ready', remotePlayers)

    await Effect.runPromise(syncMultiplayerPlayerListPanel(playerListPanelFixture.panel, multiplayer))

    expect(multiplayer.getRemotePlayers).toHaveBeenCalledOnce()
    expect(playerListPanelFixture.playersSnapshots).toEqual([Array.from(remotePlayers.values())])
  })
})
