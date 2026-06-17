import { Effect, Option } from 'effect'
import { SettingsError } from './errors'

export class SettingsStoragePort extends Effect.Service<SettingsStoragePort>()(
  '@minecraft/application/SettingsStoragePort',
  {
    succeed: {
      /* c8 ignore next 2 */
      loadSettings: (): Effect.Effect<Option.Option<unknown>, SettingsError> => Effect.succeed(Option.none()),
      /* c8 ignore next 2 */
      saveSettings: (_settings: unknown): Effect.Effect<void, SettingsError> => Effect.void,
    },
  }
) {}
