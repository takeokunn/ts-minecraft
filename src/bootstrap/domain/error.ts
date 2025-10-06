import type { ParseError } from '@effect/schema/ParseResult'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Option, pipe, Schema } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import * as Match from 'effect/Match'
import type { LifecycleIntent, LifecycleState } from './lifecycle'

const NormalizedMessageSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => 'メッセージは空文字列にできません',
  }),
  Schema.brand('NormalizedMessage'),
  Schema.annotations({
    title: 'NormalizedMessage',
    description: 'トリム済みで空でないエラーメッセージ文字列',
  })
)

type NormalizedMessage = Schema.Schema.Type<typeof NormalizedMessageSchema>

const normalize = Schema.decodeUnknownSync(NormalizedMessageSchema)

const fallbackMessage: NormalizedMessage = normalize('Invalid configuration message')

const normalizeMessage = (message: string | null | undefined): NormalizedMessage =>
  pipe(
    message,
    Option.fromNullable,
    Option.map((candidate) => candidate.trim()),
    Option.filter((candidate) => candidate.length > 0),
    Option.map(normalize),
    Option.getOrElse(() => fallbackMessage)
  )

export type ConfigIssue = {
  readonly path: ReadonlyArray<string>
  readonly message: NormalizedMessage
}

export type ConfigIssueList = readonly [ConfigIssue, ...ConfigIssue[]]

export type InitializationStage = 'config' | 'services' | 'runtime'

export const AppError = Data.taggedEnum('AppError', {
  Config: Data.tagged('Config')<{
    readonly issues: ConfigIssueList
  }>(),
  Initialization: Data.tagged('Initialization')<{
    readonly stage: InitializationStage
    readonly message: NormalizedMessage
    readonly details: Option.Option<NormalizedMessage>
  }>(),
  Lifecycle: Data.tagged('Lifecycle')<{
    readonly current: LifecycleState
    readonly requested: LifecycleIntent
    readonly message: NormalizedMessage
  }>(),
})

export type AppError = Data.TaggedEnum<typeof AppError>

export const makeConfigIssue = (params: {
  readonly path: Iterable<string>
  readonly message: string | null | undefined
}): ConfigIssue => ({
  path: Array.from(params.path),
  message: normalizeMessage(params.message),
})

export const makeConfigError = (issues: ConfigIssueList): AppError => AppError.Config({ issues })

export const makeInitializationError = (params: {
  readonly stage: InitializationStage
  readonly message: string | null | undefined
  readonly details?: string | null | undefined
}): AppError =>
  AppError.Initialization({
    stage: params.stage,
    message: normalizeMessage(params.message),
    details: pipe(params.details, Option.fromNullable, Option.map(normalizeMessage)),
  })

export const makeLifecycleError = (params: {
  readonly current: LifecycleState
  readonly requested: LifecycleIntent
  readonly message: string | null | undefined
}): AppError =>
  AppError.Lifecycle({
    current: params.current,
    requested: params.requested,
    message: normalizeMessage(params.message),
  })

const renderParseError = (error: ParseError | Error | string): NormalizedMessage =>
  Match.value(error).pipe(
    Match.when((value): value is string => typeof value === 'string', normalizeMessage),
    Match.when(
      (value): value is Error => value instanceof Error,
      (value) => normalizeMessage(value.message)
    ),
    Match.orElse((value) => pipe(value, TreeFormatter.formatErrorSync, normalizeMessage))
  )

export const toConfigIssueList = (error: ParseError | Error | string): ConfigIssueList => {
  const issue = makeConfigIssue({ path: [], message: renderParseError(error) })
  return [issue]
}

export const formatAppError = (error: AppError): string =>
  Match.value(error).pipe(
    Match.when({ _tag: 'Config' }, ({ issues }) =>
      issues
        .map((issue) =>
          pipe(
            issue.path,
            ReadonlyArray.match({
              onEmpty: () => `config => ${issue.message}`,
              onNonEmpty: (segments) => `config:${segments.join('.')} => ${issue.message}`,
            })
          )
        )
        .join(', ')
    ),
    Match.when({ _tag: 'Initialization' }, ({ message }) => message),
    Match.when({ _tag: 'Lifecycle' }, ({ message }) => message),
    Match.exhaustive
  )

export const appErrorStage = (error: AppError): Option.Option<InitializationStage> =>
  Match.value(error).pipe(
    Match.when({ _tag: 'Initialization' }, ({ stage }) => Option.some(stage)),
    Match.orElse(() => Option.none<InitializationStage>())
  )
