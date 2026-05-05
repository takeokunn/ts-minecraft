import { describe, it, expect } from 'vitest'
import { EnvironmentPort } from './environment-port'

describe('EnvironmentPort', () => {
  it('key equals "@minecraft/env/EnvironmentPort"', () => {
    expect(EnvironmentPort.key).toBe('@minecraft/env/EnvironmentPort')
  })
})
