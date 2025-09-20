import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppServiceLive } from '../../services/AppService'
import { MainLayer } from '../MainLayer'

describe('MainLayer', () => {
  it('should export AppServiceLive as MainLayer', () => {
    expect(MainLayer).toBe(AppServiceLive)
  })

  it('should be a valid Layer', () => {
    expect(Layer.isLayer(MainLayer)).toBe(true)
  })

  it('should provide the correct service type', () => {
    // MainLayer should provide the same services as AppServiceLive
    const layerInstance = MainLayer
    expect(layerInstance).toBeDefined()

    // Check that it's the same reference
    expect(layerInstance === AppServiceLive).toBe(true)
  })

  it('should be usable in Layer composition', () => {
    // Test that MainLayer can be used in typical Layer patterns
    const composedLayer = Layer.merge(MainLayer, Layer.empty)
    expect(Layer.isLayer(composedLayer)).toBe(true)
  })

  it('should maintain all properties of AppServiceLive', () => {
    // Ensure MainLayer is identical to AppServiceLive
    const mainLayerProps = Object.getOwnPropertyNames(MainLayer)
    const appServiceProps = Object.getOwnPropertyNames(AppServiceLive)

    expect(mainLayerProps).toEqual(appServiceProps)
  })
})
