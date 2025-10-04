import { describe, expect, it } from '@effect/vitest'
import * as Domain from './index'
import { BootstrapConfigDefaults } from './config'
import { makeLifecycleSnapshot } from './lifecycle'
import { makeLifecycleError } from './error'

describe('bootstrap/domain/index barrel', () => {
  it('configモジュールを再エクスポートしている', () => {
    expect(Domain.BootstrapConfigDefaults).toBe(BootstrapConfigDefaults)
  })

  it('lifecycleモジュールを再エクスポートしている', () => {
    expect(Domain.makeLifecycleSnapshot).toBe(makeLifecycleSnapshot)
  })

  it('errorモジュールを再エクスポートしている', () => {
    expect(Domain.makeLifecycleError).toBe(makeLifecycleError)
  })
})

