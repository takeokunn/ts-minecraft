import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import { createGameDebugger, type GameDebuggerConfig, type DebugBreakpoint } from '../debugger'
import { WorldState } from '@domain/entities'
import { runEffect, expectEffect } from '../../__tests__/setup'

// Mock WorldState
const createMockWorldState = (): WorldState => ({
  entities: new Map(),
  chunks: new Map(),
  systems: new Map(),
  settings: {
    seed: 'test-seed',
    worldType: 'default',
    generateStructures: true
  }
})

// Mock DOM methods
const mockDocument = () => {
  const elements = new Map<string, HTMLElement>()
  
  // Mock DOM element
  const createMockElement = (tagName: string): HTMLElement => {
    const element = {
      tagName: tagName.toUpperCase(),
      id: '',
      style: {} as CSSStyleDeclaration,
      innerHTML: '',
      textContent: '',
      children: [] as HTMLElement[],
      querySelector: vi.fn((selector: string) => {
        if (selector.startsWith('#')) {
          const id = selector.slice(1)
          return Array.from(elements.values()).find(el => el.id === id) || null
        }
        return null
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      remove: vi.fn()
    } as any
    
    return element
  }

  global.document = {
    createElement: vi.fn((tagName: string) => {
      const element = createMockElement(tagName)
      return element
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    } as any,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any

  global.window = {
    setInterval: vi.fn((callback: () => void, delay: number) => {
      const id = Math.random()
      setTimeout(callback, 0) // Execute immediately for tests
      return id
    }),
    clearInterval: vi.fn()
  } as any
}

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: { DEV: false }, // Set to false to avoid auto-initialization
  writable: true
})

describe('GameDebugger', () => {
  let mockWorldState: WorldState
  let mockConfig: Partial<GameDebuggerConfig>

  beforeEach(() => {
    mockDocument()
    mockWorldState = createMockWorldState()
    mockConfig = {
      updateInterval: 50,
      enableKeyboardShortcuts: false, // Disable for testing
      enablePerformanceIntegration: false // Disable for testing
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createGameDebugger', () => {
    it('should create debugger with default config', async () => {
      const debugger = await runEffect(createGameDebugger(mockWorldState))
      
      expect(debugger).toBeDefined()
      expect(typeof debugger.enable).toBe('function')
      expect(typeof debugger.disable).toBe('function')
      expect(typeof debugger.toggle).toBe('function')
      expect(typeof debugger.update).toBe('function')
    })

    it('should create debugger with custom config', async () => {
      const customConfig: Partial<GameDebuggerConfig> = {
        updateInterval: 200,
        overlayPosition: { top: 50, right: 50 },
        detailsPosition: { top: 100, left: 100 }
      }
      
      const debugger = await runEffect(createGameDebugger(mockWorldState, customConfig))
      
      expect(debugger).toBeDefined()
    })

    it('should handle empty config', async () => {
      const debugger = await runEffect(createGameDebugger(mockWorldState, {}))
      
      expect(debugger).toBeDefined()
    })
  })

  describe('enable/disable functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
    })

    it('should enable debugger', async () => {
      await runEffect(debugger.enable())
      
      expect(global.document.createElement).toHaveBeenCalledWith('div')
      expect(global.document.body.appendChild).toHaveBeenCalled()
    })

    it('should disable debugger', async () => {
      await runEffect(debugger.enable())
      await runEffect(debugger.disable())
      
      expect(global.document.body.removeChild).toHaveBeenCalled()
    })

    it('should toggle debugger state', async () => {
      // First toggle should enable
      await runEffect(debugger.toggle())
      expect(global.document.body.appendChild).toHaveBeenCalled()
      
      // Second toggle should disable
      await runEffect(debugger.toggle())
      expect(global.document.body.removeChild).toHaveBeenCalled()
    })

    it('should handle multiple enable calls gracefully', async () => {
      await runEffect(debugger.enable())
      await runEffect(debugger.enable())
      
      // Should not create duplicate elements
      expect(global.document.createElement).toHaveBeenCalledWith('div')
    })

    it('should handle disable before enable', async () => {
      await runEffect(debugger.disable())
      
      // Should not throw error
      expect(global.document.body.removeChild).not.toHaveBeenCalled()
    })
  })

  describe('pause/resume functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should toggle pause state', async () => {
      await runEffect(debugger.togglePause())
      // Should have paused (state changes are internal)
      
      await runEffect(debugger.togglePause())
      // Should have resumed
    })

    it('should step frame when paused', async () => {
      await runEffect(debugger.togglePause()) // Pause first
      await runEffect(debugger.stepFrame())
      
      // Should have stepped one frame
    })

    it('should not step frame when not paused', async () => {
      // Don't pause, try to step
      await runEffect(debugger.stepFrame())
      
      // Should not step when not paused
    })
  })

  describe('recording functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should toggle recording state', async () => {
      await runEffect(debugger.toggleRecording())
      // Should have started recording
      
      await runEffect(debugger.toggleRecording())
      // Should have stopped recording
    })

    it('should export debug data', async () => {
      const debugData = await runEffect(debugger.exportDebugData())
      
      expect(debugData).toBeDefined()
      expect(debugData).toHaveProperty('sessions')
      expect(debugData).toHaveProperty('breakpoints')
      expect(debugData).toHaveProperty('state')
      expect(debugData).toHaveProperty('currentFrame')
      expect(debugData).toHaveProperty('performance')
      
      expect(Array.isArray(debugData.sessions)).toBe(true)
      expect(Array.isArray(debugData.breakpoints)).toBe(true)
      expect(typeof debugData.currentFrame).toBe('number')
    })
  })

  describe('breakpoint functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should add breakpoint', async () => {
      const breakpoint: DebugBreakpoint = {
        id: 'test-breakpoint-1',
        type: 'component',
        condition: 'entity.health < 10',
        enabled: true,
        hitCount: 0
      }
      
      await runEffect(debugger.addBreakpoint(breakpoint))
      
      const debugData = await runEffect(debugger.exportDebugData())
      expect(debugData.breakpoints).toHaveLength(1)
      expect(debugData.breakpoints[0].id).toBe('test-breakpoint-1')
    })

    it('should remove breakpoint', async () => {
      const breakpoint: DebugBreakpoint = {
        id: 'test-breakpoint-2',
        type: 'system',
        condition: 'fps < 30',
        enabled: true,
        hitCount: 0
      }
      
      await runEffect(debugger.addBreakpoint(breakpoint))
      await runEffect(debugger.removeBreakpoint('test-breakpoint-2'))
      
      const debugData = await runEffect(debugger.exportDebugData())
      expect(debugData.breakpoints).toHaveLength(0)
    })

    it('should handle removing non-existent breakpoint', async () => {
      await runEffect(debugger.removeBreakpoint('non-existent'))
      
      // Should not throw error
      const debugData = await runEffect(debugger.exportDebugData())
      expect(debugData.breakpoints).toHaveLength(0)
    })

    it('should handle multiple breakpoints', async () => {
      const breakpoints: DebugBreakpoint[] = [
        {
          id: 'bp-1',
          type: 'component',
          condition: 'condition1',
          enabled: true,
          hitCount: 0
        },
        {
          id: 'bp-2',
          type: 'system',
          condition: 'condition2',
          enabled: false,
          hitCount: 0
        },
        {
          id: 'bp-3',
          type: 'entity',
          condition: 'condition3',
          enabled: true,
          hitCount: 0
        }
      ]
      
      for (const bp of breakpoints) {
        await runEffect(debugger.addBreakpoint(bp))
      }
      
      const debugData = await runEffect(debugger.exportDebugData())
      expect(debugData.breakpoints).toHaveLength(3)
      
      const ids = debugData.breakpoints.map(bp => bp.id)
      expect(ids).toContain('bp-1')
      expect(ids).toContain('bp-2')
      expect(ids).toContain('bp-3')
    })
  })

  describe('entity watching functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should watch entity', async () => {
      await runEffect(debugger.watchEntity('entity-1'))
      
      const state = await runEffect(debugger.getState())
      expect(state.watchedEntities.has('entity-1')).toBe(true)
    })

    it('should unwatch entity', async () => {
      await runEffect(debugger.watchEntity('entity-2'))
      await runEffect(debugger.unwatchEntity('entity-2'))
      
      const state = await runEffect(debugger.getState())
      expect(state.watchedEntities.has('entity-2')).toBe(false)
    })

    it('should handle watching multiple entities', async () => {
      const entities = ['entity-1', 'entity-2', 'entity-3', 'player-1']
      
      for (const entityId of entities) {
        await runEffect(debugger.watchEntity(entityId))
      }
      
      const state = await runEffect(debugger.getState())
      expect(state.watchedEntities.size).toBe(4)
      
      entities.forEach(entityId => {
        expect(state.watchedEntities.has(entityId)).toBe(true)
      })
    })

    it('should handle unwatching non-watched entity', async () => {
      await runEffect(debugger.unwatchEntity('non-watched-entity'))
      
      // Should not throw error
      const state = await runEffect(debugger.getState())
      expect(state.watchedEntities.has('non-watched-entity')).toBe(false)
    })
  })

  describe('update functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should update with delta time', async () => {
      await runEffect(debugger.update(16.67)) // ~60 FPS
      
      // Update should not throw error
    })

    it('should handle zero delta time', async () => {
      await runEffect(debugger.update(0))
      
      // Should handle gracefully
    })

    it('should handle negative delta time', async () => {
      await runEffect(debugger.update(-1))
      
      // Should handle gracefully
    })

    it('should handle very large delta time', async () => {
      await runEffect(debugger.update(10000))
      
      // Should handle gracefully
    })

    it('should update when not enabled', async () => {
      await runEffect(debugger.disable())
      await runEffect(debugger.update(16.67))
      
      // Should do nothing but not throw error
    })
  })

  describe('state management', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should return current state', async () => {
      const state = await runEffect(debugger.getState())
      
      expect(state).toBeDefined()
      expect(state).toHaveProperty('showOverlay')
      expect(state).toHaveProperty('showPerformanceGraph')
      expect(state).toHaveProperty('showMemoryUsage')
      expect(state).toHaveProperty('showEntityCount')
      expect(state).toHaveProperty('showSystemMetrics')
      expect(state).toHaveProperty('recordingSession')
      expect(state).toHaveProperty('watchedEntities')
      expect(state).toHaveProperty('watchedComponents')
      expect(state).toHaveProperty('breakpoints')
      expect(state).toHaveProperty('frameByFrameMode')
      expect(state).toHaveProperty('stepMode')
      
      expect(typeof state.showOverlay).toBe('boolean')
      expect(typeof state.recordingSession).toBe('boolean')
      expect(typeof state.frameByFrameMode).toBe('boolean')
      expect(state.watchedEntities instanceof Set).toBe(true)
      expect(state.watchedComponents instanceof Set).toBe(true)
      expect(state.breakpoints instanceof Map).toBe(true)
    })

    it('should maintain state consistency', async () => {
      // Make various state changes
      await runEffect(debugger.watchEntity('entity-1'))
      await runEffect(debugger.watchEntity('entity-2'))
      
      const breakpoint: DebugBreakpoint = {
        id: 'test-bp',
        type: 'performance',
        condition: 'fps < 30',
        enabled: true,
        hitCount: 0
      }
      await runEffect(debugger.addBreakpoint(breakpoint))
      
      await runEffect(debugger.toggleRecording())
      await runEffect(debugger.togglePause())
      
      const state = await runEffect(debugger.getState())
      
      expect(state.watchedEntities.size).toBe(2)
      expect(state.breakpoints.size).toBe(1)
      expect(state.recordingSession).toBe(true)
    })
  })

  describe('details panel functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should show details panel', async () => {
      await runEffect(debugger.showDetailsPanel())
      
      // Should create and show details panel
      expect(global.document.createElement).toHaveBeenCalledWith('div')
    })
  })

  describe('destroy functionality', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      await runEffect(debugger.enable())
    })

    it('should destroy debugger completely', async () => {
      // Add some state first
      await runEffect(debugger.watchEntity('entity-1'))
      const breakpoint: DebugBreakpoint = {
        id: 'destroy-test',
        type: 'component',
        condition: 'test',
        enabled: true,
        hitCount: 0
      }
      await runEffect(debugger.addBreakpoint(breakpoint))
      
      await runEffect(debugger.destroy())
      
      // Should clean up everything
      expect(global.document.body.removeChild).toHaveBeenCalled()
    })

    it('should handle destroy when not enabled', async () => {
      await runEffect(debugger.disable())
      await runEffect(debugger.destroy())
      
      // Should not throw error
    })
  })

  describe('error handling', () => {
    it('should handle DOM creation errors gracefully', async () => {
      // Mock document.createElement to throw
      global.document.createElement = vi.fn(() => {
        throw new Error('DOM creation failed')
      })
      
      const debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
      
      // Should handle the error during enable
      await expect(runEffect(debugger.enable())).rejects.toThrow('DOM creation failed')
    })

    it('should handle null world state', async () => {
      const debugger = await runEffect(createGameDebugger(null as any, mockConfig))
      
      expect(debugger).toBeDefined()
      // Should work even with null world state
    })

    it('should handle invalid config values', async () => {
      const invalidConfig = {
        updateInterval: -1,
        overlayPosition: { top: NaN, right: NaN },
        detailsPosition: { top: undefined, left: null },
        enableKeyboardShortcuts: 'invalid',
        enablePerformanceIntegration: {}
      } as any
      
      const debugger = await runEffect(createGameDebugger(mockWorldState, invalidConfig))
      
      expect(debugger).toBeDefined()
    })
  })

  describe('integration scenarios', () => {
    let debugger: any

    beforeEach(async () => {
      debugger = await runEffect(createGameDebugger(mockWorldState, mockConfig))
    })

    it('should handle complete debugging workflow', async () => {
      // Enable debugger
      await runEffect(debugger.enable())
      
      // Watch entities
      await runEffect(debugger.watchEntity('player-1'))
      await runEffect(debugger.watchEntity('mob-1'))
      
      // Add breakpoints
      const breakpoint1: DebugBreakpoint = {
        id: 'health-check',
        type: 'component',
        condition: 'health < 20',
        enabled: true,
        hitCount: 0
      }
      const breakpoint2: DebugBreakpoint = {
        id: 'performance-check',
        type: 'performance',
        condition: 'fps < 30',
        enabled: true,
        hitCount: 0
      }
      
      await runEffect(debugger.addBreakpoint(breakpoint1))
      await runEffect(debugger.addBreakpoint(breakpoint2))
      
      // Start recording
      await runEffect(debugger.toggleRecording())
      
      // Update several frames
      for (let i = 0; i < 5; i++) {
        await runEffect(debugger.update(16.67))
      }
      
      // Pause and step
      await runEffect(debugger.togglePause())
      await runEffect(debugger.stepFrame())
      await runEffect(debugger.stepFrame())
      
      // Stop recording
      await runEffect(debugger.toggleRecording())
      
      // Export data
      const debugData = await runEffect(debugger.exportDebugData())
      
      expect(debugData.sessions).toBeDefined()
      expect(debugData.breakpoints).toHaveLength(2)
      expect(debugData.state.watchedEntities.size).toBe(2)
      
      // Cleanup
      await runEffect(debugger.destroy())
    })

    it('should handle rapid state changes', async () => {
      await runEffect(debugger.enable())
      
      // Rapid toggles
      for (let i = 0; i < 10; i++) {
        await runEffect(debugger.togglePause())
        await runEffect(debugger.toggleRecording())
      }
      
      // Should handle without errors
      const state = await runEffect(debugger.getState())
      expect(state).toBeDefined()
    })

    it('should handle concurrent operations', async () => {
      await runEffect(debugger.enable())
      
      const operations = [
        debugger.watchEntity('entity-1'),
        debugger.watchEntity('entity-2'),
        debugger.toggleRecording(),
        debugger.addBreakpoint({
          id: 'concurrent-bp',
          type: 'system',
          condition: 'concurrent test',
          enabled: true,
          hitCount: 0
        }),
        debugger.update(16.67),
        debugger.showDetailsPanel()
      ]
      
      await runEffect(Effect.all(operations))
      
      const state = await runEffect(debugger.getState())
      expect(state.watchedEntities.size).toBe(2)
    })
  })
})