import { describe, expect, it } from '@effect/vitest'
import * as Bootstrap from './index'
import { instantiateLifecycleSnapshot } from './application'
import { ConfigLayer } from './infrastructure'

describe('bootstrap/index barrel', () => {
  it('applicationモジュールを再エクスポートする', () => {
    expect(Bootstrap.instantiateLifecycleSnapshot).toBe(instantiateLifecycleSnapshot)
  })

  it('infrastructureモジュールを再エクスポートする', () => {
    expect(Bootstrap.ConfigLayer).toBe(ConfigLayer)
  })
})

