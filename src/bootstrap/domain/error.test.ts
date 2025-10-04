import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  AppError,
  ConfigIssue,
  ConfigIssueList,
  appErrorStage,
  formatAppError,
  makeConfigError,
  makeConfigIssue,
  makeInitializationError,
  makeLifecycleError,
  toConfigIssueList,
} from './error'

const sampleIssue = makeConfigIssue({ path: ['root', 'fps'], message: '  must be between 1 and 120 ' })

const singletonIssueList = (issue: ConfigIssue): ConfigIssueList => {
  const tuple: readonly [ConfigIssue] = [issue]
  return tuple
}

describe('bootstrap/domain/error', () => {
  it('makeConfigIssueはpathコピーとメッセージtrimを行う', () => {
    expect(sampleIssue.path).toStrictEqual(['root', 'fps'])
    expect(sampleIssue.message).toBe('must be between 1 and 120')
  })

  it('makeConfigErrorはConfigタグを付与する', () => {
    const error = makeConfigError(singletonIssueList(sampleIssue))
    expect(error).toMatchObject({ _tag: 'Config' })
    expect(error.issues).toHaveLength(1)
  })

  it('makeInitializationErrorはdetailsをOptionで保持する', () => {
    const error = makeInitializationError({
      stage: 'config',
      message: '  failed  ',
      details: '  detail  ',
    })
    expect(error).toMatchObject({ _tag: 'Initialization', stage: 'config' })
    expect(error.message).toBe('failed')
    expect(error.details).toStrictEqual(Option.some('detail'))
  })

  it('makeLifecycleErrorはLifecycleタグを返す', () => {
    const error = makeLifecycleError({
      current: 'initializing',
      requested: 'status',
      message: '  waiting  ',
    })
    expect(error).toMatchObject({ _tag: 'Lifecycle', current: 'initializing' })
    expect(error.message).toBe('waiting')
  })

  it('toConfigIssueListはParseError相当の文字列からIssueListを生成する', () => {
    const issues = toConfigIssueList('  invalid value  ')
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toBe('invalid value')
  })

  it('formatAppErrorはタグごとに適切なメッセージを生成する', () => {
    const config = makeConfigError(singletonIssueList(sampleIssue))
    const initialization = makeInitializationError({ stage: 'runtime', message: 'boom' })
    const lifecycle = makeLifecycleError({ current: 'uninitialized', requested: 'status', message: 'not ready' })

    expect(formatAppError(config)).toContain('config:root.fps')
    expect(formatAppError(initialization)).toBe('boom')
    expect(formatAppError(lifecycle)).toBe('not ready')
  })

  it('appErrorStageはInitializationのみStageを返す', () => {
    const initialization = makeInitializationError({ stage: 'services', message: 'fail' })
    const lifecycle = makeLifecycleError({ current: 'ready', requested: 'initialize', message: 'done' })

    expect(appErrorStage(initialization)).toStrictEqual(Option.some('services'))
    expect(appErrorStage(lifecycle)).toStrictEqual(Option.none())
  })

  it.prop('formatAppErrorは空文字列を返さない', [
    fc.constantFrom<AppError>(
      makeConfigError(singletonIssueList(sampleIssue)),
      makeInitializationError({ stage: 'services', message: 'service failure' }),
      makeLifecycleError({ current: 'ready', requested: 'status', message: 'ok' })
    ),
  ], ([error]) => {
    const message = formatAppError(error)
    expect(message.trim().length).toBeGreaterThan(0)
  })
})
