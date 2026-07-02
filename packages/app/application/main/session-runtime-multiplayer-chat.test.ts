import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option, Stream } from 'effect'

import {
  forwardMultiplayerChatSends,
  syncMultiplayerChatOverlay,
} from '@ts-minecraft/app/main/session-runtime-multiplayer-chat'
import type { ChatPanelEntry } from '@ts-minecraft/presentation'

const makePanel = (onSend: Stream.Stream<string> = Stream.empty) => {
  const showSpy = vi.fn()
  const hideSpy = vi.fn()
  return {
    element: {} as HTMLElement,
    onSend,
    setMessages: vi.fn((_messages: ReadonlyArray<ChatPanelEntry>) => Effect.void),
    setConnected: vi.fn((_connected: boolean) => Effect.void),
    show: Effect.sync(showSpy),
    hide: Effect.sync(hideSpy),
    showSpy,
    hideSpy,
  }
}

const makeMultiplayer = (messages: ReadonlyArray<ChatPanelEntry> = []) => ({
  getChatMessages: vi.fn(() => Effect.succeed(messages)),
  sendChat: vi.fn((_text: string) => Effect.void),
})

describe('session-runtime-multiplayer-chat', () => {
  it.effect('hides and disables the chat panel when multiplayer is absent', () =>
    Effect.gen(function* () {
      const panel = makePanel()
      yield* syncMultiplayerChatOverlay(panel as never, Option.none())
      expect(panel.setConnected).toHaveBeenCalledWith(false)
      expect(panel.hideSpy).toHaveBeenCalledOnce()
      expect(panel.setMessages).not.toHaveBeenCalled()
    })
  )

  it.effect('syncs messages and shows the chat panel when multiplayer is present', () =>
    Effect.gen(function* () {
      const messages = [{ player: 'Alex', text: 'hello', timestamp: 1 }]
      const panel = makePanel()
      const multiplayer = makeMultiplayer(messages)
      yield* syncMultiplayerChatOverlay(panel as never, Option.some(multiplayer as never))
      expect(multiplayer.getChatMessages).toHaveBeenCalledOnce()
      expect(panel.setMessages).toHaveBeenCalledWith(messages)
      expect(panel.setConnected).toHaveBeenCalledWith(true)
      expect(panel.showSpy).toHaveBeenCalledOnce()
    })
  )

  it.effect('forwards chat panel send events to the multiplayer service', () =>
    Effect.gen(function* () {
      const panel = makePanel(Stream.make('from panel'))
      const multiplayer = makeMultiplayer()
      yield* forwardMultiplayerChatSends(panel as never, multiplayer as never)
      expect(multiplayer.sendChat).toHaveBeenCalledWith('from panel')
    })
  )
})
