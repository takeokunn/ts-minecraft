import * as TreeFormatter from '@effect/schema/TreeFormatter'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import type { ParseError } from '@effect/schema/ParseResult'
import type { LifecycleIntent, LifecycleState } from './lifecycle'

export type ConfigIssue = {
  readonly path: ReadonlyArray<string>
  readonly message: string
}

export type ConfigIssueList = readonly [ConfigIssue, ...ConfigIssue[]]

export type InitializationStage = 'config' | 'services' | 'runtime'

export type ConfigError = {
  readonly _tag: 'Config'
  readonly issues: ConfigIssueList
}

export type InitializationError = {
  readonly _tag: 'Initialization'
  readonly stage: InitializationStage
  readonly message: string
  readonly details?: string
}

export type LifecycleError = {
  readonly _tag: 'Lifecycle'
  readonly current: LifecycleState
  readonly requested: LifecycleIntent
  readonly message: string
}

export type AppError = ConfigError | InitializationError | LifecycleError

const ensureMessage = (message: string): string => {
  const trimmed = message.trim()
  return trimmed.length > 0 ? trimmed : 'Invalid configuration message'
}

export const makeConfigIssue = (params: {
  readonly path: Iterable<string>
  readonly message: string
}): ConfigIssue => ({
  path: Array.from(params.path),
  message: ensureMessage(params.message),
})

export const makeConfigError = (issues: ConfigIssueList): AppError => ({
  _tag: 'Config',
  issues,
})

export const makeInitializationError = (params: {
  readonly stage: InitializationStage
  readonly message: string
  readonly details?: string
}): AppError => ({
  _tag: 'Initialization',
  stage: params.stage,
  message: ensureMessage(params.message),
  details: params.details ? ensureMessage(params.details) : undefined,
})

export const makeLifecycleError = (params: {
  readonly current: LifecycleState
  readonly requested: LifecycleIntent
  readonly message: string
}): AppError => ({
  _tag: 'Lifecycle',
  current: params.current,
  requested: params.requested,
  message: ensureMessage(params.message),
})

const renderParseError = (error: ParseError | Error | string): string => {
  if (typeof error === 'string') {
    return ensureMessage(error)
  }
  if (error instanceof Error) {
    return ensureMessage(error.message)
  }
  return ensureMessage(TreeFormatter.formatErrorSync(error))
}

export const toConfigIssueList = (error: ParseError | Error | string): ConfigIssueList => {
  const message = renderParseError(error)
  const issue = makeConfigIssue({ path: [], message })
  return [issue]
}

export const formatAppError = (error: AppError): string =>
  Match.value(error).pipe(
    Match.when({ _tag: 'Config' }, (value) =>
      value.issues
        .map((issue) => `config:${issue.path.join('.')} => ${issue.message}`)
        .join(', ')
    ),
    Match.when({ _tag: 'Initialization' }, (value) => value.message),
    Match.when({ _tag: 'Lifecycle' }, (value) => value.message),
    Match.exhaustive
  )

export const appErrorStage = (error: AppError): Option.Option<InitializationStage> =>
  Match.value(error).pipe(
    Match.when({ _tag: 'Initialization' }, (value) => Option.some(value.stage)),
    Match.orElse(() => Option.none())
  )
