import { Array as Arr, Effect, Option } from 'effect'

export const registerComposerDisposal = (
  composerRT: { dispose(): void },
  composer: { dispose(): void },
  passes: ReadonlyArray<Option.Option<{ dispose(): void }>>,
) =>
  Effect.acquireRelease(
    Effect.void,
    () => Effect.sync(() => {
      Arr.forEach(passes, (pass) => { Option.getOrNull(pass)?.dispose() })
      composerRT.dispose()
      composer.dispose()
    }),
  )
