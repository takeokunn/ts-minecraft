import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'

import { buildMultiplayerBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap/multiplayer'

describe('buildMultiplayerBootstrapServices', () => {
  it.effect('enables multiplayer runtime services by default', () =>
    Effect.gen(function* () {
      const services = yield* buildMultiplayerBootstrapServices

      expect(Option.isSome(services.multiplayerService)).toBe(true)
    })
  )
})
