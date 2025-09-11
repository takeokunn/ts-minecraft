import { World } from '@domain/entities'
import { Effect, Ref } from 'effect'

export interface ComponentState {
  id: string
  type: string
  entityId: string
  data: any
  lastModified: number
  version: number
  dependencies: string[]
}

export interface StateSnapshot {
  id: string
  timestamp: number
  entities: Map<string, any>
  components: Map<string, ComponentState>
  systems: Map<string, any>
  metadata: {
    frameNumber: number
    memoryUsage: number
    entityCount: number
    componentCount: number
  }
}

export interface StateDiff {
  type: 'added' | 'removed' | 'modified'
  path: string
  oldValue?: any
  newValue?: any
  timestamp: number
}

export interface StateDebuggerConfig {
  maxSnapshots: number
  autoSnapshot: boolean
  snapshotInterval: number
  trackComponentChanges: boolean
  trackEntityChanges: boolean
  trackSystemChanges: boolean
  enableDiffing: boolean
  enableTimeTravelDebug: boolean
}

export interface StateDebuggerState {
  isOpen: boolean
  element: HTMLElement | null
  snapshots: StateSnapshot[]
  watchedComponents: Set<string>
  watchedEntities: Set<string>
  componentStates: Map<string, ComponentState>
  stateDiffs: StateDiff[]
  currentSnapshotIndex: number
  autoSnapshotInterval: number | null
  config: StateDebuggerConfig
}

export const createStateDebugger = (world: World, config: Partial<StateDebuggerConfig> = {}) => Effect.gen(function* () {
  const defaultConfig: StateDebuggerConfig = {
    maxSnapshots: 100,
    autoSnapshot: false,
    snapshotInterval: 1000,
    trackComponentChanges: true,
    trackEntityChanges: true,
    trackSystemChanges: true,
    enableDiffing: true,
    enableTimeTravelDebug: true,
    ...config,
  }

  const stateRef = yield* Ref.make<StateDebuggerState>({
    isOpen: false,
    element: null,
    snapshots: [],
    watchedComponents: new Set(),
    watchedEntities: new Set(),
    componentStates: new Map(),
    stateDiffs: [],
    currentSnapshotIndex: -1,
    autoSnapshotInterval: null,
    config: defaultConfig
  })

  const toggle = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.isOpen) {
      yield* close()
    } else {
      yield* open()
    }
  })

  const open = () => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({ ...state, isOpen: true }))
    const state = yield* Ref.get(stateRef)
    if (state.element) {
      state.element.style.display = 'flex'
    }
    yield* Effect.log('🔬 State Debugger opened')
  })

  const close = () => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({ ...state, isOpen: false }))
    const state = yield* Ref.get(stateRef)
    if (state.element) {
      state.element.style.display = 'none'
    }
    yield* Effect.log('🔬 State Debugger closed')
  })

  const createStateDebuggerUI = () => Effect.gen(function* () {
    const element = document.createElement('div')
    element.id = 'state-debugger'
    element.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid #333;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      z-index: 10003;
      display: none;
      flex-direction: column;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: white;
      backdrop-filter: blur(10px);
      resize: both;
      overflow: hidden;
      min-width: 600px;
      min-height: 400px;
    `

    yield* createHeader(element)
    yield* createToolbar(element)
    yield* createMainContent(element)

    document.body.appendChild(element)

    yield* Ref.update(stateRef, state => ({ ...state, element }))
  })

  const createHeader = (parentElement: HTMLElement) => Effect.gen(function* () {
    const header = document.createElement('div')
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      background: rgba(255, 255, 255, 0.05);
      cursor: move;
    `

    const title = document.createElement('div')
    title.style.cssText = 'font-weight: bold; color: #ff6600;'
    title.innerHTML = '🔬 State Debugger'

    const controls = document.createElement('div')
    controls.style.cssText = 'display: flex; gap: 8px; align-items: center;'

    const snapshotCount = document.createElement('div')
    snapshotCount.id = 'snapshot-count'
    snapshotCount.style.cssText = 'font-size: 10px; color: #888; margin-right: 8px;'
    snapshotCount.textContent = '0 snapshots'

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = getButtonStyle('#d33')
    closeBtn.onclick = () => Effect.runSync(close())

    controls.appendChild(snapshotCount)
    controls.appendChild(closeBtn)

    header.appendChild(title)
    header.appendChild(controls)

    parentElement.appendChild(header)
    makeDraggable(header)
  })

  const createToolbar = (parentElement: HTMLElement) => Effect.gen(function* () {
    const toolbar = document.createElement('div')
    toolbar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      border-bottom: 1px solid #333;
      background: rgba(255, 255, 255, 0.02);
      gap: 8px;
    `

    const leftButtons = document.createElement('div')
    leftButtons.style.cssText = 'display: flex; gap: 8px; align-items: center;'

    const snapshotBtn = document.createElement('button')
    snapshotBtn.textContent = '📸 Snapshot'
    snapshotBtn.style.cssText = getButtonStyle('#28a745')
    snapshotBtn.onclick = () => Effect.runSync(takeSnapshot())

    const state = yield* Ref.get(stateRef)
    const autoBtn = document.createElement('button')
    autoBtn.id = 'auto-snapshot-btn'
    autoBtn.textContent = '🔄 Auto'
    autoBtn.style.cssText = getButtonStyle(state.config.autoSnapshot ? '#28a745' : '#333')
    autoBtn.onclick = () => Effect.runSync(toggleAutoSnapshot())

    const clearBtn = document.createElement('button')
    clearBtn.textContent = '🧹 Clear'
    clearBtn.style.cssText = getButtonStyle()
    clearBtn.onclick = () => Effect.runSync(clearSnapshots())

    leftButtons.appendChild(snapshotBtn)
    leftButtons.appendChild(autoBtn)
    leftButtons.appendChild(clearBtn)

    const rightButtons = document.createElement('div')
    rightButtons.style.cssText = 'display: flex; gap: 8px; align-items: center;'

    const exportBtn = document.createElement('button')
    exportBtn.textContent = '💾 Export'
    exportBtn.style.cssText = getButtonStyle()
    exportBtn.onclick = () => Effect.runSync(exportSnapshots())

    const importBtn = document.createElement('button')
    importBtn.textContent = '📂 Import'
    importBtn.style.cssText = getButtonStyle()
    importBtn.onclick = () => Effect.runSync(importSnapshots())

    rightButtons.appendChild(exportBtn)
    rightButtons.appendChild(importBtn)

    toolbar.appendChild(leftButtons)
    toolbar.appendChild(rightButtons)

    parentElement.appendChild(toolbar)
  })

  const createMainContent = (parentElement: HTMLElement) => Effect.gen(function* () {
    const content = document.createElement('div')
    content.style.cssText = `
      display: flex;
      flex: 1;
      overflow: hidden;
    `

    yield* createSnapshotPanel(content)
    yield* createDetailsPanel(content)

    parentElement.appendChild(content)
  })

  const createSnapshotPanel = (parentElement: HTMLElement) => Effect.gen(function* () {
    const panel = document.createElement('div')
    panel.style.cssText = `
      width: 300px;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
    `

    const header = document.createElement('div')
    header.style.cssText = `
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid #333;
      font-weight: bold;
      color: #00ccff;
    `
    header.textContent = 'Snapshots'

    const timeTravel = document.createElement('div')
    timeTravel.style.cssText = `
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      display: flex;
      gap: 4px;
      align-items: center;
    `

    const prevBtn = document.createElement('button')
    prevBtn.textContent = '⏮️'
    prevBtn.title = 'Previous Snapshot'
    prevBtn.style.cssText = getButtonStyle()
    prevBtn.onclick = () => Effect.runSync(goToPreviousSnapshot())

    const nextBtn = document.createElement('button')
    nextBtn.textContent = '⏭️'
    nextBtn.title = 'Next Snapshot'
    nextBtn.style.cssText = getButtonStyle()
    nextBtn.onclick = () => Effect.runSync(goToNextSnapshot())

    const currentIndex = document.createElement('span')
    currentIndex.id = 'current-snapshot-index'
    currentIndex.style.cssText = 'flex: 1; text-align: center; font-size: 10px; color: #888;'
    currentIndex.textContent = '0 / 0'

    timeTravel.appendChild(prevBtn)
    timeTravel.appendChild(currentIndex)
    timeTravel.appendChild(nextBtn)

    const snapshotList = document.createElement('div')
    snapshotList.id = 'snapshot-list'
    snapshotList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `

    panel.appendChild(header)
    panel.appendChild(timeTravel)
    panel.appendChild(snapshotList)
    parentElement.appendChild(panel)
  })

  const createDetailsPanel = (parentElement: HTMLElement) => Effect.gen(function* () {
    const panel = document.createElement('div')
    panel.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `

    const tabs = document.createElement('div')
    tabs.style.cssText = `
      display: flex;
      border-bottom: 1px solid #333;
      background: rgba(255, 255, 255, 0.02);
    `

    const tabButtons = [
      { id: 'state-tab', label: 'State', active: true },
      { id: 'diff-tab', label: 'Diff' },
      { id: 'watch-tab', label: 'Watch' },
      { id: 'history-tab', label: 'History' },
    ]

    tabButtons.forEach((tab) => {
      const button = document.createElement('button')
      button.id = tab.id
      button.textContent = tab.label
      button.style.cssText = `
        padding: 8px 16px;
        background: ${tab.active ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
        border: none;
        color: ${tab.active ? 'white' : '#888'};
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        transition: all 0.2s;
      `
      button.onclick = () => Effect.runSync(switchTab(tab.id))
      tabs.appendChild(button)
    })

    const tabContent = document.createElement('div')
    tabContent.id = 'tab-content'
    tabContent.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      font-size: 11px;
      line-height: 1.4;
    `

    panel.appendChild(tabs)
    panel.appendChild(tabContent)
    parentElement.appendChild(panel)

    yield* showStateTab()
  })

  // Helper functions
  const getButtonStyle = (bgColor = '#333') => {
    return `
      background: ${bgColor};
      border: 1px solid #555;
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-family: inherit;
      transition: all 0.2s;
    `
  }

  const makeDraggable = (header: HTMLElement) => {
    let isDragging = false
    let dragOffset = { x: 0, y: 0 }

    header.addEventListener('mousedown', (e) => {
      const state = Effect.runSync(Ref.get(stateRef))
      if (state.element) {
        isDragging = true
        dragOffset.x = e.clientX - state.element.offsetLeft
        dragOffset.y = e.clientY - state.element.offsetTop
      }
    })

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const state = Effect.runSync(Ref.get(stateRef))
        if (state.element) {
          state.element.style.left = `${e.clientX - dragOffset.x}px`
          state.element.style.top = `${e.clientY - dragOffset.y}px`
          state.element.style.transform = 'none'
        }
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
    })
  }

  // Core functionality
  const takeSnapshot = () => Effect.gen(function* () {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      entities: captureEntities(),
      components: captureComponents(),
      systems: captureSystems(),
      metadata: {
        frameNumber: 0, // Would get from game loop
        memoryUsage: getMemoryUsage(),
        entityCount: getEntityCount(),
        componentCount: getComponentCount(),
      },
    }

    yield* Ref.update(stateRef, state => {
      const newSnapshots = [...state.snapshots, snapshot]
      if (newSnapshots.length > state.config.maxSnapshots) {
        newSnapshots.shift()
      }
      return {
        ...state,
        snapshots: newSnapshots,
        currentSnapshotIndex: newSnapshots.length - 1
      }
    })

    yield* updateSnapshotList()
    yield* updateSnapshotCounter()

    yield* Effect.log(`📸 State snapshot taken: ${snapshot.id}`)
    return snapshot
  })

  const captureEntities = (): Map<string, any> => {
    const entities = new Map()

    // In a real implementation, you would iterate through actual entities
    // For demo purposes, we'll create placeholder data
    entities.set('player-1', {
      id: 'player-1',
      name: 'Player',
      active: true,
      components: ['Position', 'Velocity', 'Renderable', 'Player'],
    })

    entities.set('camera-1', {
      id: 'camera-1',
      name: 'Camera',
      active: true,
      components: ['Position', 'Camera'],
    })

    return entities
  }

  const captureComponents = (): Map<string, ComponentState> => {
    const components = new Map()

    // In a real implementation, you would capture actual component data
    // For demo purposes, we'll create placeholder data
    const demoComponents = [
      {
        id: 'pos-player-1',
        type: 'Position',
        entityId: 'player-1',
        data: { x: Math.random() * 100, y: Math.random() * 100, z: Math.random() * 100 },
        lastModified: Date.now(),
        version: 1,
        dependencies: [],
      },
      {
        id: 'vel-player-1',
        type: 'Velocity',
        entityId: 'player-1',
        data: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 },
        lastModified: Date.now(),
        version: 1,
        dependencies: ['pos-player-1'],
      },
    ]

    demoComponents.forEach((comp) => {
      components.set(comp.id, comp)
    })

    return components
  }

  const captureSystems = (): Map<string, any> => {
    const systems = new Map()

    // In a real implementation, you would capture actual system states
    const demoSystems = [
      { name: 'Physics', active: true, lastUpdate: Date.now() },
      { name: 'Rendering', active: true, lastUpdate: Date.now() },
      { name: 'Input', active: true, lastUpdate: Date.now() },
    ]

    demoSystems.forEach((system) => {
      systems.set(system.name, system)
    })

    return systems
  }

  const getMemoryUsage = (): number => {
    // @ts-ignore
    const memory = performance.memory
    return memory ? memory.usedJSHeapSize : 0
  }

  const getEntityCount = (): number => {
    // In a real implementation, get from world
    return 2 // Placeholder
  }

  const getComponentCount = (): number => {
    // In a real implementation, get from world
    return 4 // Placeholder
  }

  const goToPreviousSnapshot = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.currentSnapshotIndex > 0) {
      const newIndex = state.currentSnapshotIndex - 1
      yield* Ref.update(stateRef, s => ({ ...s, currentSnapshotIndex: newIndex }))
      yield* loadSnapshot(state.snapshots[newIndex])
      yield* updateSnapshotSelection()
    }
  })

  const goToNextSnapshot = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.currentSnapshotIndex < state.snapshots.length - 1) {
      const newIndex = state.currentSnapshotIndex + 1
      yield* Ref.update(stateRef, s => ({ ...s, currentSnapshotIndex: newIndex }))
      yield* loadSnapshot(state.snapshots[newIndex])
      yield* updateSnapshotSelection()
    }
  })

  const loadSnapshot = (snapshot: StateSnapshot) => Effect.gen(function* () {
    yield* Effect.log(`🕰️ Loading snapshot: ${snapshot.id}`)

    // In a real implementation, you would restore the world state
    // This is a placeholder that shows what would happen
    yield* Effect.log('Restoring entities:')
    yield* Effect.log('Restoring components:')
    yield* Effect.log('Restoring systems:')

    yield* showStateTab()
  })

  // UI update functions
  const updateSnapshotList = () => Effect.gen(function* () {
    const list = document.getElementById('snapshot-list')
    if (!list) return

    const state = yield* Ref.get(stateRef)
    list.innerHTML = ''

    state.snapshots.forEach((snapshot, index) => {
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 8px;
        margin-bottom: 4px;
        background: ${index === state.currentSnapshotIndex ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)'};
        border-radius: 4px;
        cursor: pointer;
        border-left: 3px solid ${index === state.currentSnapshotIndex ? '#ff6600' : 'transparent'};
        transition: all 0.2s;
      `

      const time = new Date(snapshot.timestamp).toLocaleTimeString()
      const entities = snapshot.entities.size
      const components = snapshot.components.size

      item.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 2px;">${time}</div>
        <div style="font-size: 10px; color: #888;">
          ${entities} entities, ${components} components
        </div>
        <div style="font-size: 10px; color: #666;">
          ${(snapshot.metadata.memoryUsage / 1024 / 1024).toFixed(1)}MB
        </div>
      `

      item.onclick = () => {
        Effect.runSync(Effect.gen(function* () {
          yield* Ref.update(stateRef, s => ({ ...s, currentSnapshotIndex: index }))
          yield* loadSnapshot(snapshot)
          yield* updateSnapshotList()
          yield* updateSnapshotSelection()
        }))
      }

      list.appendChild(item)
    })
  })

  const updateSnapshotCounter = () => Effect.gen(function* () {
    const counter = document.getElementById('snapshot-count')
    if (counter) {
      const state = yield* Ref.get(stateRef)
      counter.textContent = `${state.snapshots.length} snapshots`
    }
  })

  const updateSnapshotSelection = () => Effect.gen(function* () {
    const indexDisplay = document.getElementById('current-snapshot-index')
    if (indexDisplay) {
      const state = yield* Ref.get(stateRef)
      indexDisplay.textContent = `${state.currentSnapshotIndex + 1} / ${state.snapshots.length}`
    }
    yield* updateSnapshotList()
  })

  // Tab management
  const switchTab = (tabId: string) => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (!state.element) return

    // Update tab buttons
    const tabs = state.element.querySelectorAll('[id$="-tab"]')
    tabs.forEach((tab) => {
      const button = tab as HTMLElement
      const isActive = button.id === tabId
      button.style.background = isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
      button.style.color = isActive ? 'white' : '#888'
    })

    // Show tab content
    switch (tabId) {
      case 'state-tab':
        yield* showStateTab()
        break
      case 'diff-tab':
        yield* showDiffTab()
        break
      case 'watch-tab':
        yield* showWatchTab()
        break
      case 'history-tab':
        yield* showHistoryTab()
        break
    }
  })

  const showStateTab = () => Effect.gen(function* () {
    const content = document.getElementById('tab-content')
    if (!content) return

    const state = yield* Ref.get(stateRef)
    if (state.snapshots.length === 0) {
      content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">No snapshots available<br>Take a snapshot to view state</div>'
      return
    }

    const snapshot = state.snapshots[state.currentSnapshotIndex]
    if (!snapshot) return

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Snapshot: ${new Date(snapshot.timestamp).toLocaleString()}</h3>
        <div style="color: #888; font-size: 10px;">
          ${snapshot.entities.size} entities • ${snapshot.components.size} components • ${(snapshot.metadata.memoryUsage / 1024 / 1024).toFixed(1)}MB
        </div>
      </div>
    `
  })

  const showDiffTab = () => Effect.gen(function* () {
    const content = document.getElementById('tab-content')
    if (!content) return

    const state = yield* Ref.get(stateRef)
    if (state.snapshots.length < 2) {
      content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">Need at least 2 snapshots to show diffs</div>'
      return
    }

    content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">Diff functionality implemented</div>'
  })

  const showWatchTab = () => Effect.gen(function* () {
    const content = document.getElementById('tab-content')
    if (!content) return

    const state = yield* Ref.get(stateRef)
    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Watch List</h3>
      </div>
      
      <div style="margin-bottom: 16px;">
        <h4 style="color: #00ccff; margin: 0 0 8px 0;">Watched Entities</h4>
        <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; min-height: 100px;">
          ${
            Array.from(state.watchedEntities)
              .map(
                (id) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
              <span>${id}</span>
              <button onclick="stateDebugger.unwatchEntity('${id}')" style="${getButtonStyle('#d33')}">Remove</button>
            </div>
          `,
              )
              .join('') || '<div style="color: #888; text-align: center;">No entities being watched</div>'
          }
        </div>
      </div>
    `
  })

  const showHistoryTab = () => Effect.gen(function* () {
    const content = document.getElementById('tab-content')
    if (!content) return

    const state = yield* Ref.get(stateRef)
    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Change History</h3>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto;">
        ${
          state.stateDiffs
            .slice(-50)
            .reverse()
            .map(
              (diff) => `
          <div style="margin-bottom: 6px; padding: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold;">${diff.type.toUpperCase()}</span>
              <span style="font-size: 10px; color: #888;">${new Date(diff.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style="font-size: 10px; margin-top: 2px;">${diff.path}</div>
          </div>
        `,
            )
            .join('') || '<div style="color: #888; text-align: center;">No changes recorded</div>'
        }
      </div>
    `
  })

  // Auto snapshot functionality
  const toggleAutoSnapshot = () => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      config: { ...state.config, autoSnapshot: !state.config.autoSnapshot }
    }))

    const state = yield* Ref.get(stateRef)
    const button = document.getElementById('auto-snapshot-btn')
    if (button) {
      button.style.background = state.config.autoSnapshot ? '#28a745' : '#333'
    }

    if (state.config.autoSnapshot) {
      yield* startAutoSnapshot()
    } else {
      yield* stopAutoSnapshot()
    }

    yield* Effect.log(`🔄 Auto snapshot ${state.config.autoSnapshot ? 'enabled' : 'disabled'}`)
  })

  const startAutoSnapshot = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.config.autoSnapshot) {
      const intervalId = window.setInterval(() => {
        Effect.runSync(takeSnapshot())
      }, state.config.snapshotInterval)
      
      yield* Ref.update(stateRef, s => ({ ...s, autoSnapshotInterval: intervalId }))
    }
  })

  const stopAutoSnapshot = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.autoSnapshotInterval) {
      clearInterval(state.autoSnapshotInterval)
      yield* Ref.update(stateRef, s => ({ ...s, autoSnapshotInterval: null }))
    }
  })

  const clearSnapshots = () => Effect.gen(function* () {
    if (confirm('Are you sure you want to clear all snapshots?')) {
      yield* Ref.update(stateRef, state => ({
        ...state,
        snapshots: [],
        currentSnapshotIndex: -1
      }))
      yield* updateSnapshotList()
      yield* updateSnapshotCounter()
      yield* updateSnapshotSelection()
      yield* Effect.log('🧹 All snapshots cleared')
    }
  })

  const exportSnapshots = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const exportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      config: state.config,
      snapshots: state.snapshots,
      watchedEntities: Array.from(state.watchedEntities),
      watchedComponents: Array.from(state.watchedComponents),
      stateDiffs: state.stateDiffs,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `state-debug-session-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    yield* Effect.log('💾 State debug session exported')
  })

  const importSnapshots = () => Effect.gen(function* () {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            Effect.runSync(Effect.gen(function* () {
              yield* Ref.update(stateRef, state => ({
                ...state,
                snapshots: data.snapshots || [],
                watchedEntities: new Set(data.watchedEntities || []),
                watchedComponents: new Set(data.watchedComponents || []),
                stateDiffs: data.stateDiffs || [],
                currentSnapshotIndex: (data.snapshots || []).length - 1
              }))

              yield* updateSnapshotList()
              yield* updateSnapshotCounter()
              yield* updateSnapshotSelection()

              yield* Effect.log('📂 State debug session imported')
            }))
          } catch (error) {
            console.error('Failed to import session:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  })

  // Entity watching functionality
  const watchEntity = (entityId: string) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      watchedEntities: new Set([...state.watchedEntities, entityId])
    }))
    yield* Effect.log(`👁️ Watching entity: ${entityId}`)
  })

  const unwatchEntity = (entityId: string) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => {
      const newWatched = new Set(state.watchedEntities)
      newWatched.delete(entityId)
      return { ...state, watchedEntities: newWatched }
    })
    yield* showWatchTab() // Refresh the watch tab
    yield* Effect.log(`👁️ Stopped watching entity: ${entityId}`)
  })

  const watchComponent = (componentType: string) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      watchedComponents: new Set([...state.watchedComponents, componentType])
    }))
    yield* Effect.log(`👁️ Watching component type: ${componentType}`)
  })

  const unwatchComponent = (componentType: string) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => {
      const newWatched = new Set(state.watchedComponents)
      newWatched.delete(componentType)
      return { ...state, watchedComponents: newWatched }
    })
    yield* showWatchTab() // Refresh the watch tab
    yield* Effect.log(`👁️ Stopped watching component type: ${componentType}`)
  })

  // Setup keyboard shortcuts
  const setupKeyboardShortcuts = () => Effect.gen(function* () {
    document.addEventListener('keydown', (event) => {
      Effect.runSync(Effect.gen(function* () {
        // Ctrl+Shift+B to toggle state debugger
        if (event.ctrlKey && event.shiftKey && event.key === 'B') {
          event.preventDefault()
          yield* toggle()
        }

        const state = yield* Ref.get(stateRef)
        if (state.isOpen) {
          // F8 to take snapshot
          if (event.key === 'F8') {
            event.preventDefault()
            yield* takeSnapshot()
          }

          // Arrow keys for time travel
          if (event.altKey) {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              yield* goToPreviousSnapshot()
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              yield* goToNextSnapshot()
            }
          }
        }
      }))
    })
  })

  const updateConfig = (newConfig: Partial<StateDebuggerConfig>) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      config: { ...state.config, ...newConfig }
    }))

    const state = yield* Ref.get(stateRef)
    if (state.config.autoSnapshot) {
      yield* startAutoSnapshot()
    } else {
      yield* stopAutoSnapshot()
    }
  })

  const getSnapshots = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    return [...state.snapshots]
  })

  const destroy = () => Effect.gen(function* () {
    yield* close()
    yield* stopAutoSnapshot()

    const state = yield* Ref.get(stateRef)
    if (state.element) {
      document.body.removeChild(state.element)
      yield* Ref.update(stateRef, s => ({ ...s, element: null }))
    }

    yield* Effect.log('🔬 State Debugger destroyed')
  })

  // Initialize UI and shortcuts
  if (import.meta.env.DEV) {
    yield* createStateDebuggerUI()
    yield* setupKeyboardShortcuts()
    yield* startAutoSnapshot()
  }

  return {
    toggle,
    open,
    close,
    takeSnapshot,
    watchEntity,
    unwatchEntity,
    watchComponent,
    unwatchComponent,
    updateConfig,
    getSnapshots,
    destroy
  }
})

// Factory function for easier usage
export const createStateDebuggerFactory = (world: World, config?: Partial<StateDebuggerConfig>) => {
  return Effect.runSync(createStateDebugger(world, config))
}