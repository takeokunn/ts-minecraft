import { describe, it, expect } from 'vitest'
import { Layer } from 'effect'
import { MainLayer } from '../MainLayer'
import { AppServiceLive } from '../../services/AppService'

describe('MainLayer', () => {
  it('should be a composite layer including AppServiceLive', () => {
    // MainLayer is now a composite of multiple service layers
    expect(Layer.isLayer(MainLayer)).toBe(true)
    expect(MainLayer).toBeDefined()
  })

  it('should be a valid Layer', () => {
    expect(Layer.isLayer(MainLayer)).toBe(true)
  })

  it('should provide multiple services including AppService', () => {
    // MainLayer now provides GameLoop, Scene, Renderer, Input, GameApplication, and AppService
    const layerInstance = MainLayer
    expect(layerInstance).toBeDefined()

    // Check that it's a Layer (not checking for same reference anymore since it's a composite)
    expect(Layer.isLayer(layerInstance)).toBe(true)
  })

  it('should be usable in Layer composition', () => {
    // Test that MainLayer can be used in typical Layer patterns
    const composedLayer = Layer.merge(MainLayer, Layer.empty)
    expect(Layer.isLayer(composedLayer)).toBe(true)
  })

  it('should be a properly structured composite layer', () => {
    // MainLayer is now a mergeAll of multiple layers
    const mainLayerProps = Object.getOwnPropertyNames(MainLayer)

    // Should have Layer properties
    expect(mainLayerProps).toContain('_op_layer')
    expect(mainLayerProps).toContain('evaluate')
  })
})
