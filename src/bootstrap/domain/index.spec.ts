import { describe, expect, it } from '@effect/vitest'
import { BootstrapConfigDefaults } from './config'
import { makeLifecycleError } from './error'
import * as Domain from './index'
import { makeLifecycleSnapshot } from './lifecycle'

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
