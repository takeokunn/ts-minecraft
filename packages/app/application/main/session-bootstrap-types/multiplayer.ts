import type { Option } from 'effect'

import type { MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

export type SessionMultiplayerBootstrapServices = {
  readonly multiplayerService: Option.Option<MultiplayerService>
}
