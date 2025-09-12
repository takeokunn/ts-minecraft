/**
 * Entity Inspector - Functional Module Implementation
 *
 * Converted from class-based implementation to functional Effect-TS module
 * Features:
 * - Interactive entity browser and inspector
 * - Real-time entity list updates
 * - Component inspection with JSON viewing
 * - Entity search and filtering
 * - Entity manipulation (delete, toggle, clone)
 * - Draggable UI panel
 * - Performance statistics
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import { World } from '@domain/entities'

export interface EntityInfo {
  id: string
  name: string
  components: unknown[]
  position?: { x: number; y: number; z: number }
  active: boolean
}

export interface EntityInspectorState {
  isOpen: boolean
  inspectorElement: HTMLElement | null
  entityListElement: HTMLElement | null
  detailsElement: HTMLElement | null
  searchElement: HTMLInputElement | null
  selectedEntityId: string | null
  updateInterval: number | null
  dragState: {
    isDragging: boolean
    dragOffsetX: number
    dragOffsetY: number
  }
}

export interface EntityInspectorConfig {
  autoRefreshInterval: number
  position: { top: number; right: number }
  size: { width: number; height: number }
}

const defaultConfig: EntityInspectorConfig = {
  autoRefreshInterval: 1000,
  position: { top: 50, right: 50 },
  size: { width: 600, height: 500 },
}

/**
 * Create Entity Inspector functional module
 */
export const createEntityInspector = (world: World, config: Partial<EntityInspectorConfig> = {}) =>
  Effect.gen(function* () {
    const finalConfig = { ...defaultConfig, ...config }

    const stateRef = yield* Ref.make<EntityInspectorState>({
      isOpen: false,
      inspectorElement: null,
      entityListElement: null,
      detailsElement: null,
      searchElement: null,
      selectedEntityId: null,
      updateInterval: null,
      dragState: {
        isDragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
      },
    })

    /**
     * Create inspector UI structure
     */
    const createInspectorUI = Effect.gen(function* () {
      if (!import.meta.env.DEV) return

      const state = yield* Ref.get(stateRef)
      if (state.inspectorElement) return

      const inspectorElement = document.createElement('div')
      inspectorElement.id = 'entity-inspector'
      inspectorElement.style.cssText = `
        position: fixed;
        top: ${finalConfig.position.top}px;
        right: ${finalConfig.position.right}px;
        width: ${finalConfig.size.width}px;
        height: ${finalConfig.size.height}px;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #333;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 10001;
        display: none;
        flex-direction: column;
      `

      yield* createHeader(inspectorElement)
      yield* createContent(inspectorElement)

      document.body.appendChild(inspectorElement)
      yield* setupEventListeners(inspectorElement)

      yield* Ref.update(stateRef, (s) => ({ ...s, inspectorElement }))
    })

    /**
     * Create header with title and controls
     */
    const createHeader = (parent: HTMLElement) =>
      Effect.gen(function* () {
        const header = document.createElement('div')
        header.style.cssText = `
        background: #333;
        color: #fff;
        padding: 8px 12px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 6px 6px 0 0;
      `

        const title = document.createElement('span')
        title.textContent = '🔍 Entity Inspector'

        const controls = document.createElement('div')
        controls.style.cssText = 'display: flex; gap: 5px; align-items: center;'

        const refreshButton = document.createElement('button')
        refreshButton.textContent = '🔄'
        refreshButton.title = 'Refresh'
        refreshButton.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        refreshButton.onclick = () => Effect.runSync(refreshEntityList())

        const closeButton = document.createElement('button')
        closeButton.textContent = '✕'
        closeButton.style.cssText = 'background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        closeButton.onclick = () => Effect.runSync(close())

        controls.appendChild(refreshButton)
        controls.appendChild(closeButton)

        header.appendChild(title)
        header.appendChild(controls)

        parent.appendChild(header)
      })

    /**
     * Create main content area with entity list and details
     */
    const createContent = (parent: HTMLElement) =>
      Effect.gen(function* () {
        const content = document.createElement('div')
        content.style.cssText = `
        display: flex;
        flex: 1;
        min-height: 0;
      `

        // Left panel: Entity list
        const leftPanel = document.createElement('div')
        leftPanel.style.cssText = `
        width: 250px;
        border-right: 1px solid #333;
        display: flex;
        flex-direction: column;
      `

        // Search box
        const searchElement = document.createElement('input')
        searchElement.type = 'text'
        searchElement.placeholder = 'Search entities...'
        searchElement.style.cssText = `
        background: #222;
        border: 1px solid #444;
        color: #fff;
        padding: 5px;
        margin: 5px;
        border-radius: 3px;
        outline: none;
      `

        const entityListElement = document.createElement('div')
        entityListElement.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 5px;
      `

        leftPanel.appendChild(searchElement)
        leftPanel.appendChild(entityListElement)

        // Right panel: Details
        const detailsElement = document.createElement('div')
        detailsElement.style.cssText = `
        flex: 1;
        padding: 10px;
        overflow-y: auto;
        color: #fff;
      `

        content.appendChild(leftPanel)
        content.appendChild(detailsElement)

        parent.appendChild(content)

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          searchElement,
          entityListElement,
          detailsElement,
        }))
      })

    /**
     * Setup event listeners for search and drag functionality
     */
    const setupEventListeners = (inspectorElement: HTMLElement) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        // Search functionality
        state.searchElement?.addEventListener('input', () => {
          Effect.runSync(filterEntityList())
        })

        // Drag functionality
        const header = inspectorElement.querySelector('div')
        if (header && isHTMLElement(header)) {
          header.style.cursor = 'move'

          header.addEventListener('mousedown', (e) => {
            Effect.runSync(
              Ref.update(stateRef, (s) => ({
                ...s,
                dragState: {
                  isDragging: true,
                  dragOffsetX: e.clientX - inspectorElement.offsetLeft,
                  dragOffsetY: e.clientY - inspectorElement.offsetTop,
                },
              })),
            )
          })
        }

        document.addEventListener('mousemove', (e) => {
          Effect.runSync(
            Effect.gen(function* () {
              const currentState = yield* Ref.get(stateRef)
              if (currentState.dragState.isDragging && currentState.inspectorElement) {
                currentState.inspectorElement.style.left = `${e.clientX - currentState.dragState.dragOffsetX}px`
                currentState.inspectorElement.style.top = `${e.clientY - currentState.dragState.dragOffsetY}px`
                currentState.inspectorElement.style.right = 'auto'
              }
            }),
          )
        })

        document.addEventListener('mouseup', () => {
          Effect.runSync(
            Ref.update(stateRef, (s) => ({
              ...s,
              dragState: { ...s.dragState, isDragging: false },
            })),
          )
        })
      })

    /**
     * Toggle inspector visibility
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
     * Open inspector
     */
    const open = Effect.gen(function* () {
      yield* createInspectorUI()

      const state = yield* Ref.get(stateRef)
      if (state.inspectorElement) {
        state.inspectorElement.style.display = 'flex'
        yield* refreshEntityList()
        yield* startAutoRefresh()
      }

      yield* Ref.update(stateRef, (s) => ({ ...s, isOpen: true }))
      console.log('🔍 Entity Inspector opened')
    })

    /**
     * Close inspector
     */
    const close = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.inspectorElement) {
        state.inspectorElement.style.display = 'none'
        yield* stopAutoRefresh()
      }

      yield* Ref.update(stateRef, (s) => ({ ...s, isOpen: false }))
      console.log('🔍 Entity Inspector closed')
    })

    /**
     * Refresh entity list display
     */
    const refreshEntityList = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.entityListElement) return

      // Clear entity list
      state.entityListElement.innerHTML = ''

      // Get entities from world
      const entities = yield* getEntities()

      entities.forEach((entity) => {
        const entityElement = document.createElement('div')
        entityElement.style.cssText = `
          padding: 5px;
          margin: 2px;
          background: ${entity.id === state.selectedEntityId ? '#444' : '#222'};
          border: 1px solid #333;
          border-radius: 3px;
          cursor: pointer;
          color: ${entity.active ? '#fff' : '#888'};
        `

        entityElement.innerHTML = `
          <div><strong>${entity.name || 'Entity'}</strong></div>
          <div style="font-size: 10px; color: #aaa;">ID: ${entity.id}</div>
          <div style="font-size: 10px; color: #aaa;">Components: ${entity.components.length}</div>
        `

        entityElement.onclick = () => Effect.runSync(selectEntity(entity.id))

        const entityListElement = state.entityListElement
        if (entityListElement) {
          entityListElement.appendChild(entityElement)
        }
      })
    })

    /**
     * Filter entity list based on search term
     */
    const filterEntityList = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const searchTerm = state.searchElement?.value.toLowerCase() || ''
      const entityElements = state.entityListElement?.children

      if (!entityElements) return

      for (let i = 0; i < entityElements.length; i++) {
        const element = entityElements[i]
        if (isHTMLElement(element)) {
          const text = element.textContent?.toLowerCase() || ''
          element.style.display = text.includes(searchTerm) ? 'block' : 'none'
        }
      }
    })

    /**
     * Select an entity for detailed inspection
     */
    const selectEntity = (entityId: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => ({ ...s, selectedEntityId: entityId }))
        yield* refreshEntityList()
        yield* displayEntityDetails(entityId)
      })

    /**
     * Display detailed information about selected entity
     */
    const displayEntityDetails = (entityId: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.detailsElement) return

        const entity = yield* getEntityById(entityId)
        if (!entity) {
          state.detailsElement.innerHTML = '<div style="color: #f00;">Entity not found</div>'
          return
        }

        let html = `
        <div style="margin-bottom: 15px;">
          <h3 style="color: #0cf; margin: 0 0 10px 0;">${entity.name || 'Unnamed Entity'}</h3>
          <div><strong>ID:</strong> ${entity.id}</div>
          <div><strong>Active:</strong> ${entity.active ? '✅ Yes' : '❌ No'}</div>
        `

        if (entity.position) {
          html += `
          <div><strong>Position:</strong> (${entity.position.x.toFixed(2)}, ${entity.position.y.toFixed(2)}, ${entity.position.z.toFixed(2)})</div>
        `
        }

        html += '</div>'

        // Components display
        if (entity.components.length > 0) {
          html += '<h4 style="color: #0cf; margin: 15px 0 10px 0;">Components</h4>'

          entity.components.forEach((component, index) => {
            const componentName = component.constructor?.name || `Component ${index}`
            html += `
            <div style="margin-bottom: 10px; padding: 8px; background: #1a1a1a; border-radius: 4px;">
              <div style="font-weight: bold; color: #ff6; margin-bottom: 5px;">${componentName}</div>
              <pre style="margin: 0; font-size: 10px; color: #ccc; overflow-x: auto;">${JSON.stringify(component, null, 2)}</pre>
            </div>
          `
          })
        }

        // Entity action buttons
        html += `
        <div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;">
          <h4 style="color: #0cf; margin: 0 0 10px 0;">Actions</h4>
          <button onclick="window.entityInspectorActions.deleteEntity('${entity.id}')" style="background: #d33; border: none; color: white; padding: 5px 10px; margin-right: 5px; border-radius: 3px; cursor: pointer;">Delete Entity</button>
          <button onclick="window.entityInspectorActions.toggleEntity('${entity.id}')" style="background: #555; border: none; color: white; padding: 5px 10px; margin-right: 5px; border-radius: 3px; cursor: pointer;">${entity.active ? 'Deactivate' : 'Activate'}</button>
          <button onclick="window.entityInspectorActions.cloneEntity('${entity.id}')" style="background: #3a3; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Clone</button>
        </div>
      `

        state.detailsElement.innerHTML = html

        // Expose actions globally for button callbacks
        // Safe cast: extending globalThis with additional properties for HTML button callbacks
        const globalWithActions = globalThis as typeof globalThis & {
          entityInspectorActions?: {
            deleteEntity: (id: string) => void
            toggleEntity: (id: string) => void
            cloneEntity: (id: string) => void
          }
        }
        globalWithActions.entityInspectorActions = {
          deleteEntity: (id: string) => Effect.runSync(deleteEntity(id)),
          toggleEntity: (id: string) => Effect.runSync(toggleEntity(id)),
          cloneEntity: (id: string) => Effect.runSync(cloneEntity(id)),
        }
      })

    /**
     * Start auto-refresh for real-time updates
     */
    const startAutoRefresh = Effect.gen(function* () {
      const updateInterval = window.setInterval(() => {
        Effect.runSync(
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            if (state.isOpen) {
              yield* refreshEntityList()
              if (state.selectedEntityId) {
                yield* displayEntityDetails(state.selectedEntityId)
              }
            }
          }),
        )
      }, finalConfig.autoRefreshInterval)

      yield* Ref.update(stateRef, (s) => ({ ...s, updateInterval }))
    })

    /**
     * Stop auto-refresh
     */
    const stopAutoRefresh = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.updateInterval) {
        clearInterval(state.updateInterval)
        yield* Ref.update(stateRef, (s) => ({ ...s, updateInterval: null }))
      }
    })

    /**
     * Get all entities from world (placeholder implementation)
     */
    const getEntities = Effect.succeed([
      {
        id: 'player-1',
        name: 'Player',
        components: [
          { type: 'Position', x: 0, y: 0, z: 0 },
          { type: 'Velocity', x: 0, y: 0, z: 0 },
          { type: 'Player', health: 100 },
        ],
        position: { x: 0, y: 0, z: 0 },
        active: true,
      },
      {
        id: 'block-1',
        name: 'Block',
        components: [
          { type: 'Position', x: 5, y: 0, z: 5 },
          { type: 'Block', blockType: 'stone' },
        ],
        position: { x: 5, y: 0, z: 5 },
        active: true,
      },
    ])

    /**
     * Get entity by ID
     */
    const getEntityById = (id: string) =>
      Effect.gen(function* () {
        const entities = yield* getEntities()
        return entities.find((e) => e.id === id) || null
      })

    /**
     * Delete entity
     */
    const deleteEntity = (id: string) =>
      Effect.gen(function* () {
        console.log(`🗑️ Deleting entity: ${id}`)
        // Actual deletion logic would go here
        yield* refreshEntityList()

        const state = yield* Ref.get(stateRef)
        if (state.selectedEntityId === id && state.detailsElement) {
          yield* Ref.update(stateRef, (s) => ({ ...s, selectedEntityId: null }))
          state.detailsElement.innerHTML = '<div style="color: #888;">Select an entity to view details</div>'
        }
      })

    /**
     * Toggle entity active state
     */
    const toggleEntity = (id: string) =>
      Effect.gen(function* () {
        console.log(`🔄 Toggling entity: ${id}`)
        // Actual toggle logic would go here
        yield* refreshEntityList()
        yield* displayEntityDetails(id)
      })

    /**
     * Clone entity
     */
    const cloneEntity = (id: string) =>
      Effect.gen(function* () {
        console.log(`📋 Cloning entity: ${id}`)
        // Actual cloning logic would go here
        yield* refreshEntityList()
      })

    /**
     * Inspect specific entity (external API)
     */
    const inspectEntity = (id: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.isOpen) {
          yield* open()
        }
        yield* selectEntity(id)
      })

    /**
     * Find entities by component type
     */
    const findEntitiesByComponent = (componentType: string) =>
      Effect.gen(function* () {
        const entities = yield* getEntities()
        return entities.filter((entity) => entity.components.some((comp) => comp.type === componentType))
      })

    /**
     * Get entity statistics
     */
    const getEntityStats = Effect.gen(function* () {
      const entities = yield* getEntities()
      const componentCount = new Map<string, number>()

      entities.forEach((entity) => {
        entity.components.forEach((comp) => {
          const type = comp.type || 'Unknown'
          componentCount.set(type, (componentCount.get(type) || 0) + 1)
        })
      })

      return {
        totalEntities: entities.length,
        activeEntities: entities.filter((e) => e.active).length,
        componentTypes: Array.from(componentCount.entries()).map(([type, count]) => ({ type, count })),
      }
    })

    return {
      toggle,
      open,
      close,
      refreshEntityList,
      inspectEntity,
      findEntitiesByComponent,
      getEntityStats,
    }
  })

/**
 * Type guard functions
 */
const isHTMLElement = (element: Element | null): element is HTMLElement => {
  return element !== null && element instanceof HTMLElement
}

/**
 * Create entity inspector factory for easier usage
 */
const createEntityInspectorFactory =
  (config: Partial<EntityInspectorConfig> = {}) =>
  (world: World) =>
    createEntityInspector(world, config)
