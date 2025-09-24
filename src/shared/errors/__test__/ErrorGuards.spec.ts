import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Schema, Stream, pipe } from 'effect'
import { ErrorGuards, ErrorValidation } from '../ErrorGuards'

describe('ErrorGuards', () => {
  describe('Schema-based Error Detection', () => {
    it.effect('isGameError identifies valid game errors', () =>
      Effect.gen(function* () {
        const validGameErrors = [
          { _tag: 'GameError', message: 'test error' },
          { _tag: 'InvalidStateError', message: 'invalid', currentState: 'A', expectedState: 'B' },
          { _tag: 'ResourceNotFoundError', message: 'not found', resourceType: 'texture', resourceId: 'stone' },
        ]

        yield* pipe(
          Stream.fromIterable(validGameErrors),
          Stream.mapEffect((gameError) =>
            Effect.sync(() => {
              expect(ErrorGuards.isGameError(gameError)).toBe(true)
              expect(ErrorGuards.isNetworkError(gameError)).toBe(false)
            })
          ),
          Stream.runDrain
        )
      })
    )

    it.effect('isNetworkError identifies valid network errors', () =>
      Effect.gen(function* () {
        const validNetworkErrors = [
          { _tag: 'NetworkError', message: 'network issue', code: 'NET_001' },
          {
            _tag: 'ConnectionError',
            message: 'connection failed',
            serverUrl: 'localhost:8080',
            attemptNumber: 1,
            maxAttempts: 3,
          },
          { _tag: 'TimeoutError', message: 'timeout', operation: 'connect', timeoutMs: 5000, elapsedMs: 5001 },
        ]

        yield* pipe(
          Stream.fromIterable(validNetworkErrors),
          Stream.mapEffect((networkError) =>
            Effect.sync(() => {
              console.log('Testing network error:', networkError)
              console.log('isNetworkError result:', ErrorGuards.isNetworkError(networkError))
              expect(ErrorGuards.isNetworkError(networkError)).toBe(true)
              expect(ErrorGuards.isGameError(networkError)).toBe(false)
            })
          ),
          Stream.runDrain
        )
      })
    )

    it.effect('rejects invalid error structures', () =>
      Effect.gen(function* () {
        const invalidInputs = [
          'string',
          123,
          null,
          undefined,
          { _tag: 'InvalidTag' },
          { message: 'no tag' },
          { _tag: 'GameError' }, // missing message
        ]

        yield* pipe(
          Stream.fromIterable(invalidInputs),
          Stream.mapEffect((invalidInput) =>
            Effect.sync(() => {
              expect(ErrorGuards.isGameError(invalidInput)).toBe(false)
              expect(ErrorGuards.isNetworkError(invalidInput)).toBe(false)
            })
          ),
          Stream.runDrain
        )
      })
    )
  })

  describe('Retryable Error Detection', () => {
    it.effect('identifies retryable network errors', () =>
      Effect.gen(function* () {
        const retryableErrors = [
          { _tag: 'NetworkError', message: 'connection failed', code: 'NET_001' },
          { _tag: 'TimeoutError', message: 'request timeout', operation: 'connect', timeoutMs: 5000, elapsedMs: 5001 },
          {
            _tag: 'ConnectionError',
            message: 'server error',
            serverUrl: 'localhost:8080',
            attemptNumber: 1,
            maxAttempts: 3,
          },
        ]

        retryableErrors.forEach((error) => {
          expect(ErrorGuards.isRetryableError(error)).toBe(true)
        })
      })
    )

    it.effect('identifies non-retryable errors', () =>
      Effect.gen(function* () {
        const nonRetryableErrors = [
          { _tag: 'ValidationError', message: 'invalid data' },
          { _tag: 'AuthError', message: 'unauthorized' },
          'invalid error string',
        ]

        nonRetryableErrors.forEach((error) => {
          expect(ErrorGuards.isRetryableError(error)).toBe(false)
        })
      })
    )
  })

  describe('ErrorValidation Comprehensive Tests', () => {
    it.effect('decodeGameError handles valid and invalid inputs', () =>
      Effect.gen(function* () {
        const validError = { _tag: 'GameError', message: 'chunk not found' }
        const result = ErrorValidation.decodeGameError(validError)

        expect(Either.isRight(result)).toBe(true)

        const invalidResult = ErrorValidation.decodeGameError('invalid')
        expect(Either.isLeft(invalidResult)).toBe(true)
      })
    )

    it.effect('safeDecodeError always returns valid result', () =>
      Effect.gen(function* () {
        const fallback = { _tag: 'DefaultError' as const, message: 'fallback' }
        const testInputs = [
          { _tag: 'ValidError', data: 'test' }, // valid
          'invalid string', // invalid
          null, // invalid
          { _tag: 'WrongTag' }, // invalid
        ]

        yield* pipe(
          Stream.fromIterable(testInputs),
          Stream.mapEffect((input) =>
            Effect.sync(() => {
              const result = ErrorValidation.safeDecodeError(
                Schema.Struct({ _tag: Schema.Literal('ValidError'), data: Schema.String }) as any,
                input,
                fallback
              )

              expect(result).toBeDefined()
              expect(typeof result).toBe('object')
              expect(result._tag).toBeDefined()
            })
          ),
          Stream.runDrain
        )
      })
    )
  })
})
