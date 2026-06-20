import type { DeathScreenService } from '@ts-minecraft/presentation'
import type { LoadingScreenService } from '@ts-minecraft/presentation'

export type SessionBootstrapPresentationDeps = {
  readonly loadingScreen: LoadingScreenService
  readonly deathScreen: DeathScreenService
}
