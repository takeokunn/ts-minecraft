import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Layer } from 'effect'
import { 
  DebugController,
  DebugControllerLive,
  createDebugController,
  type DebugControllerInterface,
  type DebugState
} from '../debug.controller'
import { runEffect, expectEffect } from '../../__tests__/setup'

describe('DebugController', () => {
  let debugController: DebugControllerInterface

  beforeEach(async () => {
    debugController = await runEffect(
      Effect.provide(DebugController, DebugControllerLive)
    )
  })

  describe('toggleDebugMode', () => {
    it('should toggle debug mode from false to true', async () => {
      const initialState = await runEffect(debugController.getDebugState())
      expect(initialState.debugMode).toBe(false)
      
      await runEffect(debugController.toggleDebugMode())
      
      const newState = await runEffect(debugController.getDebugState())
      expect(newState.debugMode).toBe(true)
    })

    it('should toggle debug mode from true to false', async () => {
      // First toggle to true
      await runEffect(debugController.toggleDebugMode())
      let state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(true)
      
      // Then toggle back to false
      await runEffect(debugController.toggleDebugMode())
      state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(false)
    })

    it('should not affect other debug state properties', async () => {
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showEntityInspector(true))
      
      await runEffect(debugController.toggleDebugMode())
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(true)
      expect(state.performanceStatsVisible).toBe(true)
      expect(state.entityInspectorVisible).toBe(true)
      expect(state.worldEditorVisible).toBe(false)
    })
  })

  describe('showPerformanceStats', () => {
    it('should show performance stats when visible is true', async () => {
      await runEffect(debugController.showPerformanceStats(true))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.performanceStatsVisible).toBe(true)
    })

    it('should hide performance stats when visible is false', async () => {
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showPerformanceStats(false))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.performanceStatsVisible).toBe(false)
    })

    it('should not affect other debug state properties', async () => {
      await runEffect(debugController.toggleDebugMode())
      await runEffect(debugController.showPerformanceStats(true))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(true)
      expect(state.performanceStatsVisible).toBe(true)
      expect(state.entityInspectorVisible).toBe(false)
      expect(state.worldEditorVisible).toBe(false)
    })
  })

  describe('showEntityInspector', () => {
    it('should show entity inspector when visible is true', async () => {
      await runEffect(debugController.showEntityInspector(true))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.entityInspectorVisible).toBe(true)
    })

    it('should hide entity inspector when visible is false', async () => {
      await runEffect(debugController.showEntityInspector(true))
      await runEffect(debugController.showEntityInspector(false))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.entityInspectorVisible).toBe(false)
    })
  })

  describe('showWorldEditor', () => {
    it('should show world editor when visible is true', async () => {
      await runEffect(debugController.showWorldEditor(true))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.worldEditorVisible).toBe(true)
    })

    it('should hide world editor when visible is false', async () => {
      await runEffect(debugController.showWorldEditor(true))
      await runEffect(debugController.showWorldEditor(false))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.worldEditorVisible).toBe(false)
    })
  })

  describe('executeDebugCommand', () => {
    describe('help command', () => {
      it('should return help message for "help" command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('help'))
        expect(result).toBe('Available commands: help, status, clear, toggle')
      })

      it('should handle case insensitive help command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('HELP'))
        expect(result).toBe('Available commands: help, status, clear, toggle')
      })

      it('should handle help command with whitespace', async () => {
        const result = await runEffect(debugController.executeDebugCommand('  help  '))
        expect(result).toBe('Available commands: help, status, clear, toggle')
      })
    })

    describe('status command', () => {
      it('should return status with debug off and stats off initially', async () => {
        const result = await runEffect(debugController.executeDebugCommand('status'))
        expect(result).toBe('Debug: OFF, Stats: OFF')
      })

      it('should return status with debug on after toggle', async () => {
        await runEffect(debugController.toggleDebugMode())
        const result = await runEffect(debugController.executeDebugCommand('status'))
        expect(result).toBe('Debug: ON, Stats: OFF')
      })

      it('should return status with both debug and stats on', async () => {
        await runEffect(debugController.toggleDebugMode())
        await runEffect(debugController.showPerformanceStats(true))
        const result = await runEffect(debugController.executeDebugCommand('status'))
        expect(result).toBe('Debug: ON, Stats: ON')
      })

      it('should handle case insensitive status command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('STATUS'))
        expect(result).toBe('Debug: OFF, Stats: OFF')
      })
    })

    describe('clear command', () => {
      it('should return clear message for "clear" command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('clear'))
        expect(result).toBe('Debug console cleared')
      })

      it('should handle case insensitive clear command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('CLEAR'))
        expect(result).toBe('Debug console cleared')
      })
    })

    describe('toggle command', () => {
      it('should toggle debug mode and return toggle message', async () => {
        const initialState = await runEffect(debugController.getDebugState())
        expect(initialState.debugMode).toBe(false)
        
        const result = await runEffect(debugController.executeDebugCommand('toggle'))
        expect(result).toBe('Debug mode toggled')
        
        const newState = await runEffect(debugController.getDebugState())
        expect(newState.debugMode).toBe(true)
      })

      it('should toggle debug mode back to false', async () => {
        // First toggle to true
        await runEffect(debugController.executeDebugCommand('toggle'))
        let state = await runEffect(debugController.getDebugState())
        expect(state.debugMode).toBe(true)
        
        // Then toggle back to false
        const result = await runEffect(debugController.executeDebugCommand('toggle'))
        expect(result).toBe('Debug mode toggled')
        
        state = await runEffect(debugController.getDebugState())
        expect(state.debugMode).toBe(false)
      })
    })

    describe('unknown commands', () => {
      it('should return unknown command message for invalid command', async () => {
        const result = await runEffect(debugController.executeDebugCommand('invalid'))
        expect(result).toBe('Unknown command: invalid')
      })

      it('should handle empty command', async () => {
        const result = await runEffect(debugController.executeDebugCommand(''))
        expect(result).toBe('Unknown command: ')
      })

      it('should handle command with special characters', async () => {
        const result = await runEffect(debugController.executeDebugCommand('test@123'))
        expect(result).toBe('Unknown command: test@123')
      })
    })
  })

  describe('getDebugState', () => {
    it('should return initial debug state', async () => {
      const state = await runEffect(debugController.getDebugState())
      
      expect(state).toEqual({
        debugMode: false,
        performanceStatsVisible: false,
        entityInspectorVisible: false,
        worldEditorVisible: false
      })
    })

    it('should return updated debug state after changes', async () => {
      await runEffect(debugController.toggleDebugMode())
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showEntityInspector(true))
      await runEffect(debugController.showWorldEditor(true))
      
      const state = await runEffect(debugController.getDebugState())
      
      expect(state).toEqual({
        debugMode: true,
        performanceStatsVisible: true,
        entityInspectorVisible: true,
        worldEditorVisible: true
      })
    })

    it('should always return valid DebugState structure', async () => {
      const state = await runEffect(debugController.getDebugState())
      
      expect(state).toHaveProperty('debugMode')
      expect(state).toHaveProperty('performanceStatsVisible')
      expect(state).toHaveProperty('entityInspectorVisible')
      expect(state).toHaveProperty('worldEditorVisible')
      expect(typeof state.debugMode).toBe('boolean')
      expect(typeof state.performanceStatsVisible).toBe('boolean')
      expect(typeof state.entityInspectorVisible).toBe('boolean')
      expect(typeof state.worldEditorVisible).toBe('boolean')
    })
  })

  describe('DebugControllerLive layer', () => {
    it('should create DebugController with correct interface', async () => {
      const controller = await runEffect(
        Effect.provide(DebugController, DebugControllerLive)
      )
      
      expect(controller).toBeDefined()
      expect(typeof controller.toggleDebugMode).toBe('function')
      expect(typeof controller.showPerformanceStats).toBe('function')
      expect(typeof controller.showEntityInspector).toBe('function')
      expect(typeof controller.showWorldEditor).toBe('function')
      expect(typeof controller.executeDebugCommand).toBe('function')
      expect(typeof controller.getDebugState).toBe('function')
    })

    it('should maintain separate state for multiple instances', async () => {
      const controller1 = await runEffect(
        Effect.provide(DebugController, DebugControllerLive)
      )
      const controller2 = await runEffect(
        Effect.provide(DebugController, DebugControllerLive)
      )
      
      await runEffect(controller1.toggleDebugMode())
      
      const state1 = await runEffect(controller1.getDebugState())
      const state2 = await runEffect(controller2.getDebugState())
      
      expect(state1.debugMode).toBe(true)
      expect(state2.debugMode).toBe(false)
    })
  })

  describe('createDebugController factory', () => {
    it('should create controller instance directly', () => {
      const controller = createDebugController()
      
      expect(controller).toBeDefined()
      expect(typeof controller.toggleDebugMode).toBe('function')
      expect(typeof controller.showPerformanceStats).toBe('function')
      expect(typeof controller.showEntityInspector).toBe('function')
      expect(typeof controller.showWorldEditor).toBe('function')
      expect(typeof controller.executeDebugCommand).toBe('function')
      expect(typeof controller.getDebugState).toBe('function')
    })

    it('should work with factory created controller', async () => {
      const controller = createDebugController()
      
      await runEffect(controller.toggleDebugMode())
      const state = await runEffect(controller.getDebugState())
      
      expect(state.debugMode).toBe(true)
    })
  })

  describe('Complex debug workflows', () => {
    it('should handle debug session startup flow', async () => {
      // Enable debug mode
      await runEffect(debugController.toggleDebugMode())
      
      // Enable all debug panels
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showEntityInspector(true))
      await runEffect(debugController.showWorldEditor(true))
      
      // Check status
      const statusResult = await runEffect(debugController.executeDebugCommand('status'))
      expect(statusResult).toBe('Debug: ON, Stats: ON')
      
      const state = await runEffect(debugController.getDebugState())
      expect(state).toEqual({
        debugMode: true,
        performanceStatsVisible: true,
        entityInspectorVisible: true,
        worldEditorVisible: true
      })
    })

    it('should handle debug session cleanup flow', async () => {
      // Set up debug environment
      await runEffect(debugController.toggleDebugMode())
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showEntityInspector(true))
      
      // Clean up
      await runEffect(debugController.showPerformanceStats(false))
      await runEffect(debugController.showEntityInspector(false))
      await runEffect(debugController.toggleDebugMode())
      
      const state = await runEffect(debugController.getDebugState())
      expect(state).toEqual({
        debugMode: false,
        performanceStatsVisible: false,
        entityInspectorVisible: false,
        worldEditorVisible: false
      })
    })

    it('should handle concurrent operations', async () => {
      const operations = [
        debugController.toggleDebugMode(),
        debugController.showPerformanceStats(true),
        debugController.showEntityInspector(true),
        debugController.showWorldEditor(true)
      ]
      
      await runEffect(Effect.all(operations))
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(true)
      expect(state.performanceStatsVisible).toBe(true)
      expect(state.entityInspectorVisible).toBe(true)
      expect(state.worldEditorVisible).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle multiple rapid toggles', async () => {
      // Rapid toggles
      await runEffect(debugController.toggleDebugMode()) // true
      await runEffect(debugController.toggleDebugMode()) // false
      await runEffect(debugController.toggleDebugMode()) // true
      await runEffect(debugController.toggleDebugMode()) // false
      
      const state = await runEffect(debugController.getDebugState())
      expect(state.debugMode).toBe(false)
    })

    it('should handle redundant visibility changes', async () => {
      // Set to true multiple times
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showPerformanceStats(true))
      await runEffect(debugController.showPerformanceStats(true))
      
      let state = await runEffect(debugController.getDebugState())
      expect(state.performanceStatsVisible).toBe(true)
      
      // Set to false multiple times
      await runEffect(debugController.showPerformanceStats(false))
      await runEffect(debugController.showPerformanceStats(false))
      await runEffect(debugController.showPerformanceStats(false))
      
      state = await runEffect(debugController.getDebugState())
      expect(state.performanceStatsVisible).toBe(false)
    })

    it('should handle command execution with different cases and whitespace', async () => {
      const commands = [
        'HELP',
        '  help  ',
        'Help',
        'hElP',
        '   HELP   '
      ]
      
      for (const cmd of commands) {
        const result = await runEffect(debugController.executeDebugCommand(cmd))
        expect(result).toBe('Available commands: help, status, clear, toggle')
      }
    })
  })
})