import { Cause, Duration, Effect, Option, Schedule, Stream, type Scope } from 'effect'
import type { MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { ChatPanelService } from '@ts-minecraft/presentation'

export const MULTIPLAYER_CHAT_SYNC_INTERVAL = Duration.millis(250)

export const syncMultiplayerChatOverlay = (
  chatPanel: ChatPanelService,
  multiplayer: Option.Option<MultiplayerService>,
): Effect.Effect<void, never> =>
  Option.match(multiplayer, {
    onNone: () =>
      Effect.gen(function* () {
        yield* chatPanel.setConnected(false)
        yield* chatPanel.hide
      }),
    onSome: (service) =>
      Effect.gen(function* () {
        const messages = yield* service.getChatMessages()
        yield* chatPanel.setMessages(messages)
        yield* chatPanel.setConnected(true)
        yield* chatPanel.show
      }).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`multiplayer chat sync error: ${Cause.pretty(cause)}`)
        ),
      ),
  })

export const forwardMultiplayerChatSends = (
  chatPanel: ChatPanelService,
  service: MultiplayerService,
): Effect.Effect<void, never> =>
  Stream.runForEach(chatPanel.onSend, (text) =>
    service.sendChat(text).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logError(`multiplayer chat send error: ${Cause.pretty(cause)}`)
      ),
    )
  )

export const installMultiplayerChatOverlay = (
  chatPanel: ChatPanelService,
  multiplayer: Option.Option<MultiplayerService>,
): Effect.Effect<void, never, Scope.Scope> =>
  Option.match(multiplayer, {
    onNone: () => syncMultiplayerChatOverlay(chatPanel, multiplayer),
    onSome: (service) =>
      Effect.gen(function* () {
        yield* syncMultiplayerChatOverlay(chatPanel, multiplayer)
        yield* forwardMultiplayerChatSends(chatPanel, service).pipe(Effect.forkScoped)

        yield* Effect.repeat(
          syncMultiplayerChatOverlay(chatPanel, multiplayer),
          Schedule.spaced(MULTIPLAYER_CHAT_SYNC_INTERVAL),
        ).pipe(Effect.forkScoped)
      }),
  })
