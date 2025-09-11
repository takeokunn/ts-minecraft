/**
 * World Editor - Functional Module Implementation
 *
 * Converted from class-based implementation to functional Effect-TS module
 * Features:
 * - Block placement, removal, and replacement tools
 * - Undo/Redo system with action history
 * - Area fill functionality
 * - Mouse interaction for world editing
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - Import/Export capabilities
 * - Real-time statistics
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import { World } from '@domain/entities'

export interface WorldEditAction {
  type: 'place' | 'remove' | 'replace'
  position: { x: number; y: number; z: number }
  blockType?: string
  oldBlockType?: string
}

export interface WorldEditorState {
  isOpen: boolean
  editorElement: HTMLElement | null
  selectedTool: string
  selectedBlockType: string
  actionHistory: WorldEditAction[]
  historyIndex: number
}

export interface WorldEditorConfig {
  position: { top: number; left: number }
  maxHistorySize: number
  defaultTool: string
  defaultBlockType: string
}

const defaultConfig: WorldEditorConfig = {
  position: { top: 10, left: 420 },
  maxHistorySize: 1000,
  defaultTool: 'place',
  defaultBlockType: 'stone',
}

/**
 * Create World Editor functional module
 */
export const createWorldEditor = (world: World, config: Partial<WorldEditorConfig> = {}) =>
  Effect.gen(function* () {
    const finalConfig = { ...defaultConfig, ...config }

    const stateRef = yield* Ref.make<WorldEditorState>({
      isOpen: false,
      editorElement: null,
      selectedTool: finalConfig.defaultTool,
      selectedBlockType: finalConfig.defaultBlockType,
      actionHistory: [],
      historyIndex: -1,
    })

    /**
     * Create editor UI structure
     */
    const createEditorUI = Effect.gen(function* () {
      if (!import.meta.env.DEV) return

      const state = yield* Ref.get(stateRef)
      if (state.editorElement) return

      const editorElement = document.createElement('div')
      editorElement.id = 'world-editor'
      editorElement.style.cssText = `
        position: fixed;
        top: ${finalConfig.position.top}px;
        left: ${finalConfig.position.left}px;
        width: 300px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #333;
        border-radius: 8px;
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
        color: white;
        z-index: 9997;
        display: none;
      `

      yield* createEditorContent(editorElement)
      document.body.appendChild(editorElement)
      yield* setupEventListeners(editorElement)

      yield* Ref.update(stateRef, (s) => ({ ...s, editorElement }))
    })

    /**
     * Create editor content and controls
     */
    const createEditorContent = (parent: HTMLElement) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        parent.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #0cf;">
          🏗️ World Editor
          <button id="close-button" 
                  style="float: right; background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 10px;">
          <label>Tool:</label>
          <select id="tool-select" style="margin-left: 5px; background: #333; color: white; border: 1px solid #555;">
            <option value="place" ${state.selectedTool === 'place' ? 'selected' : ''}>Place Block</option>
            <option value="remove" ${state.selectedTool === 'remove' ? 'selected' : ''}>Remove Block</option>
            <option value="replace" ${state.selectedTool === 'replace' ? 'selected' : ''}>Replace Block</option>
          </select>
        </div>
        
        <div style="margin-bottom: 10px;">
          <label>Block Type:</label>
          <select id="block-select" style="margin-left: 5px; background: #333; color: white; border: 1px solid #555;">
            <option value="stone" ${state.selectedBlockType === 'stone' ? 'selected' : ''}>Stone</option>
            <option value="grass" ${state.selectedBlockType === 'grass' ? 'selected' : ''}>Grass</option>
            <option value="dirt" ${state.selectedBlockType === 'dirt' ? 'selected' : ''}>Dirt</option>
            <option value="wood" ${state.selectedBlockType === 'wood' ? 'selected' : ''}>Wood</option>
            <option value="sand" ${state.selectedBlockType === 'sand' ? 'selected' : ''}>Sand</option>
            <option value="water" ${state.selectedBlockType === 'water' ? 'selected' : ''}>Water</option>
            <option value="air" ${state.selectedBlockType === 'air' ? 'selected' : ''}>Air</option>
          </select>
        </div>
        
        <div style="margin-bottom: 10px;">
          <label>Fill Area:</label>
          <button id="fill-button" style="margin-left: 5px; background: #555; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">
            Fill Selection
          </button>
        </div>
        
        <div style="margin-bottom: 10px;">
          <label>History:</label>
          <button id="undo-button" style="margin-left: 5px; background: #555; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">
            Undo
          </button>
          <button id="redo-button" style="margin-left: 5px; background: #555; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">
            Redo
          </button>
        </div>
        
        <div style="margin-bottom: 10px; font-size: 10px; color: #aaa;">
          <div>Left Click: Use selected tool</div>
          <div>Shift+Click: Multi-select</div>
          <div>Ctrl+Z: Undo | Ctrl+Y: Redo</div>
        </div>
        
        <div style="border-top: 1px solid #333; padding-top: 8px; font-size: 10px;">
          <div>Actions: <span id="action-count">${state.actionHistory.length}</span></div>
          <div>History Index: <span id="history-index">${state.historyIndex}</span></div>
        </div>
      `
      })

    /**
     * Setup event listeners for UI controls and keyboard shortcuts
     */
    const setupEventListeners = (editorElement: HTMLElement) =>
      Effect.gen(function* () {
        // Close button
        const closeButton = editorElement.querySelector('#close-button')
        if (closeButton) {
          closeButton.addEventListener('click', () => Effect.runSync(close()))
        }

        // Tool selection
        const toolSelect = editorElement.querySelector('#tool-select') as HTMLSelectElement
        if (toolSelect) {
          toolSelect.addEventListener('change', (e) => {
            const tool = (e.target as HTMLSelectElement).value
            Effect.runSync(Ref.update(stateRef, (s) => ({ ...s, selectedTool: tool })))
          })
        }

        // Block type selection
        const blockSelect = editorElement.querySelector('#block-select') as HTMLSelectElement
        if (blockSelect) {
          blockSelect.addEventListener('change', (e) => {
            const blockType = (e.target as HTMLSelectElement).value
            Effect.runSync(Ref.update(stateRef, (s) => ({ ...s, selectedBlockType: blockType })))
          })
        }

        // Fill functionality
        const fillButton = editorElement.querySelector('#fill-button')
        if (fillButton) {
          fillButton.addEventListener('click', () => Effect.runSync(fillSelectedArea()))
        }

        // Undo/Redo buttons
        const undoButton = editorElement.querySelector('#undo-button')
        const redoButton = editorElement.querySelector('#redo-button')

        if (undoButton) {
          undoButton.addEventListener('click', () => Effect.runSync(undo()))
        }

        if (redoButton) {
          redoButton.addEventListener('click', () => Effect.runSync(redo()))
        }

        // Keyboard shortcuts
        const keyboardHandler = (event: KeyboardEvent) => {
          Effect.runSync(
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              if (!state.isOpen) return

              if (event.ctrlKey || event.metaKey) {
                if (event.key === 'z' && !event.shiftKey) {
                  event.preventDefault()
                  yield* undo()
                } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
                  event.preventDefault()
                  yield* redo()
                }
              }
            }),
          )
        }

        document.addEventListener('keydown', keyboardHandler)

        // Mouse interaction
        const mouseHandler = (event: MouseEvent) => {
          Effect.runSync(
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              if (!state.isOpen) return
              yield* handleMouseClick(event)
            }),
          )
        }

        document.addEventListener('mousedown', mouseHandler)
      })

    /**
     * Toggle editor visibility
     */
    const toggle = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.isOpen) {
        yield* close()
      } else {
        yield* open()
      }
    })

    /**
     * Open editor
     */
    const open = Effect.gen(function* () {
      yield* createEditorUI()

      const state = yield* Ref.get(stateRef)
      if (state.editorElement) {
        state.editorElement.style.display = 'block'
      }

      yield* Ref.update(stateRef, (s) => ({ ...s, isOpen: true }))
      console.log('🏗️ World Editor opened')
    })

    /**
     * Close editor
     */
    const close = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.editorElement) {
        state.editorElement.style.display = 'none'
      }

      yield* Ref.update(stateRef, (s) => ({ ...s, isOpen: false }))
      console.log('🏗️ World Editor closed')
    })

    /**
     * Handle mouse click for world editing
     */
    const handleMouseClick = (event: MouseEvent) =>
      Effect.gen(function* () {
        const worldPos = yield* getWorldPositionFromMouse(event)
        if (!worldPos) return

        const state = yield* Ref.get(stateRef)
        yield* executeAction(state.selectedTool, worldPos)
      })

    /**
     * Get world position from mouse coordinates (placeholder implementation)
     */
    const getWorldPositionFromMouse = (_event: MouseEvent) =>
      Effect.gen(function* () {
        // In actual implementation, use Three.js raycaster to get world coordinates
        return { x: 0, y: 0, z: 0 }
      })

    /**
     * Execute editing action at position
     */
    const executeAction = (tool: string, position: { x: number; y: number; z: number }) =>
      Effect.gen(function* () {
        const validTypes = ['place', 'remove', 'replace'] as const
        if (!validTypes.includes(tool as any)) {
          console.warn(`Invalid tool type: ${tool}`)
          return
        }

        const state = yield* Ref.get(stateRef)
        const action: WorldEditAction = {
          type: tool as 'place' | 'remove' | 'replace',
          position,
        }

        switch (tool) {
          case 'place':
            action.blockType = state.selectedBlockType
            yield* placeBlock(position, state.selectedBlockType)
            break
          case 'remove':
            action.oldBlockType = yield* getBlockAt(position)
            yield* removeBlock(position)
            break
          case 'replace':
            action.oldBlockType = yield* getBlockAt(position)
            action.blockType = state.selectedBlockType
            yield* replaceBlock(position, state.selectedBlockType)
            break
        }

        yield* addToHistory(action)
        yield* updateUI()
      })

    /**
     * Place block at position
     */
    const placeBlock = (position: { x: number; y: number; z: number }, blockType: string) =>
      Effect.gen(function* () {
        console.log(`Placing ${blockType} at (${position.x}, ${position.y}, ${position.z})`)
        // Actual block placement logic would go here
      })

    /**
     * Remove block at position
     */
    const removeBlock = (position: { x: number; y: number; z: number }) =>
      Effect.gen(function* () {
        console.log(`Removing block at (${position.x}, ${position.y}, ${position.z})`)
        // Actual block removal logic would go here
      })

    /**
     * Replace block at position
     */
    const replaceBlock = (position: { x: number; y: number; z: number }, blockType: string) =>
      Effect.gen(function* () {
        console.log(`Replacing block at (${position.x}, ${position.y}, ${position.z}) with ${blockType}`)
        // Actual block replacement logic would go here
      })

    /**
     * Get block type at position
     */
    const getBlockAt = (_position: { x: number; y: number; z: number }) =>
      Effect.gen(function* () {
        // In actual implementation, get block type from world
        return 'air'
      })

    /**
     * Fill selected area with current block type
     */
    const fillSelectedArea = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      console.log(`Filling selected area with ${state.selectedBlockType}`)
      // Actual area filling logic would go here
    })

    /**
     * Add action to history
     */
    const addToHistory = (action: WorldEditAction) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          // Remove future history if we're not at the end
          let newHistory = [...state.actionHistory]
          if (state.historyIndex < newHistory.length - 1) {
            newHistory = newHistory.slice(0, state.historyIndex + 1)
          }

          newHistory.push(action)
          let newIndex = newHistory.length - 1

          // Limit history size
          if (newHistory.length > finalConfig.maxHistorySize) {
            newHistory.shift()
            newIndex--
          }

          return {
            ...state,
            actionHistory: newHistory,
            historyIndex: newIndex,
          }
        })
      })

    /**
     * Undo last action
     */
    const undo = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.historyIndex < 0) return

      const action = state.actionHistory[state.historyIndex]
      yield* revertAction(action)
      yield* Ref.update(stateRef, (s) => ({ ...s, historyIndex: s.historyIndex - 1 }))
      yield* updateUI()

      console.log('🔄 Undo action:', action)
    })

    /**
     * Redo next action
     */
    const redo = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.historyIndex >= state.actionHistory.length - 1) return

      const newIndex = state.historyIndex + 1
      const action = state.actionHistory[newIndex]
      yield* applyAction(action)
      yield* Ref.update(stateRef, (s) => ({ ...s, historyIndex: newIndex }))
      yield* updateUI()

      console.log('🔄 Redo action:', action)
    })

    /**
     * Revert an action (for undo)
     */
    const revertAction = (action: WorldEditAction) =>
      Effect.gen(function* () {
        switch (action.type) {
          case 'place':
            yield* removeBlock(action.position)
            break
          case 'remove':
            if (action.oldBlockType) {
              yield* placeBlock(action.position, action.oldBlockType)
            }
            break
          case 'replace':
            if (action.oldBlockType) {
              yield* replaceBlock(action.position, action.oldBlockType)
            }
            break
        }
      })

    /**
     * Apply an action (for redo)
     */
    const applyAction = (action: WorldEditAction) =>
      Effect.gen(function* () {
        switch (action.type) {
          case 'place':
            if (action.blockType) {
              yield* placeBlock(action.position, action.blockType)
            }
            break
          case 'remove':
            yield* removeBlock(action.position)
            break
          case 'replace':
            if (action.blockType) {
              yield* replaceBlock(action.position, action.blockType)
            }
            break
        }
      })

    /**
     * Update UI elements with current state
     */
    const updateUI = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.editorElement) return

      const actionCountEl = state.editorElement.querySelector('#action-count')
      const historyIndexEl = state.editorElement.querySelector('#history-index')

      if (actionCountEl) {
        actionCountEl.textContent = state.actionHistory.length.toString()
      }

      if (historyIndexEl) {
        historyIndexEl.textContent = state.historyIndex.toString()
      }
    })

    /**
     * Clear action history
     */
    const clearHistory = Effect.gen(function* () {
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        actionHistory: [],
        historyIndex: -1,
      }))
      yield* updateUI()
      console.log('🧹 World editor history cleared')
    })

    /**
     * Export world data
     */
    const exportWorld = Effect.gen(function* () {
      console.log('💾 Exporting world data...')
      const state = yield* Ref.get(stateRef)
      // World export logic would go here
      return {
        timestamp: Date.now(),
        actions: state.actionHistory.length,
        message: 'World export feature not implemented yet',
      }
    })

    /**
     * Import world data
     */
    const importWorld = (data: any) =>
      Effect.gen(function* () {
        console.log('📁 Importing world data...', data)
        // World import logic would go here
      })

    /**
     * Get editor statistics
     */
    const getStats = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return {
        totalActions: state.actionHistory.length,
        currentHistoryIndex: state.historyIndex,
        selectedTool: state.selectedTool,
        selectedBlockType: state.selectedBlockType,
        canUndo: state.historyIndex >= 0,
        canRedo: state.historyIndex < state.actionHistory.length - 1,
      }
    })

    return {
      toggle,
      open,
      close,
      clearHistory,
      exportWorld,
      importWorld,
      getStats,
    }
  })

/**
 * Create world editor factory for easier usage
 */
export const createWorldEditorFactory =
  (config: Partial<WorldEditorConfig> = {}) =>
  (world: World) =>
    createWorldEditor(world, config)
