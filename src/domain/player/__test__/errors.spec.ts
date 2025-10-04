import { describe, expect, it } from 'vitest'
import { PlayerConstantErrorBuilders, PlayerErrorBuilders } from '../errors'

describe('PlayerErrorBuilders', () => {
  it('IdentityViolationを生成できる', () => {
    const error = PlayerErrorBuilders.identity('invalid id', '!!')
    expect(error._tag).toBe('IdentityViolation')
    expect(error.reason).toBe('invalid id')
  })

  it('ConstraintViolationに詳細を保持する', () => {
    const details = new Map<string, unknown>([['field', 'health']])
    const error = PlayerErrorBuilders.constraint('Vitals', details)
    expect(error._tag).toBe('ConstraintViolation')
    expect(error.details.get('field')).toBe('health')
  })

  it('ClockFailureを作成できる', () => {
    const cause = new Error('clock')
    const error = PlayerErrorBuilders.clock(cause)
    expect(error._tag).toBe('ClockFailure')
    expect(error.cause._tag).toBe('Some')
  })
})

describe('PlayerConstantErrorBuilders', () => {
  it('OutOfRangeエラーを作成する', () => {
    const error = PlayerConstantErrorBuilders.outOfRange('HEALTH_MAX', 42, '0-20')
    expect(error._tag).toBe('OutOfRange')
    expect(error.value).toBe(42)
  })
})
