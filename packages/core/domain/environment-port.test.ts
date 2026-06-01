import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { EnvironmentPort } from './environment-port'

describe('EnvironmentPort', () => {
  it('key equals "@minecraft/env/EnvironmentPort"', () => {
    expect(EnvironmentPort.key).toBe('@minecraft/env/EnvironmentPort')
  })
})
