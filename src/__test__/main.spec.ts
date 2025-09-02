import { Effect, Layer } from 'effect'
import { describe, it, vi, expect } from 'vitest'
import * as main from '@/main'
import { provideTestLayer } from 'test/utils'

describe('main', () => {
  it('should return a program that can be run', () => {
    const program = main.main()
    expect(Effect.isEffect(program)).toBe(true)
  })

  it('should provide the necessary services to the main program', async () => {
    const program = main.main()
    const runnable = Effect.provide(program, provideTestLayer())
    await Effect.runPromise(runnable)
  })
})

describe('bootstrap', () => {
  it('should create a runnable bootstrap effect', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const runnable = main.bootstrap
    expect(Effect.isEffect(runnable)).toBe(true)
  })
})

describe('AppLayer', () => {
  it('should create a layer with all necessary services', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const layer = main.AppLayer(appElement)
    expect(Layer.isLayer(layer)).toBe(true)
  })
})

describe('init', () => {
  it('should set up a DOMContentLoaded event listener', () => {
    const addListenerSpy = vi.spyOn(document, 'addEventListener')
    main.init()
    expect(addListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
  })
})