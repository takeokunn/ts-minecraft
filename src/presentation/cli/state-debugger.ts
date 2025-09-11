import { World } from '@domain/entities'

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

export class StateDebugger {
  private isOpen = false
  private element: HTMLElement | null = null
  private snapshots: StateSnapshot[] = []
  private watchedComponents: Set<string> = new Set()
  private watchedEntities: Set<string> = new Set()
  private componentStates: Map<string, ComponentState> = new Map()
  private stateDiffs: StateDiff[] = []
  private currentSnapshotIndex = -1
  private autoSnapshotInterval: number | null = null
  private config: StateDebuggerConfig

  constructor(
    private world: World,
    config: Partial<StateDebuggerConfig> = {},
  ) {
    this.config = {
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

    if (import.meta.env.DEV) {
      this.createStateDebuggerUI()
      this.setupKeyboardShortcuts()
      this.startAutoSnapshot()
    }
  }

  private createStateDebuggerUI(): void {
    this.element = document.createElement('div')
    this.element.id = 'state-debugger'
    this.element.style.cssText = `
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

    this.createHeader()
    this.createToolbar()
    this.createMainContent()

    document.body.appendChild(this.element)
  }

  private createHeader(): void {
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
    closeBtn.style.cssText = this.getButtonStyle('#d33')
    closeBtn.onclick = () => this.close()

    controls.appendChild(snapshotCount)
    controls.appendChild(closeBtn)

    header.appendChild(title)
    header.appendChild(controls)

    this.element!.appendChild(header)
    this.makeDraggable(header)
  }

  private createToolbar(): void {
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
    snapshotBtn.style.cssText = this.getButtonStyle('#28a745')
    snapshotBtn.onclick = () => this.takeSnapshot()

    const autoBtn = document.createElement('button')
    autoBtn.id = 'auto-snapshot-btn'
    autoBtn.textContent = '🔄 Auto'
    autoBtn.style.cssText = this.getButtonStyle(this.config.autoSnapshot ? '#28a745' : '#333')
    autoBtn.onclick = () => this.toggleAutoSnapshot()

    const clearBtn = document.createElement('button')
    clearBtn.textContent = '🧹 Clear'
    clearBtn.style.cssText = this.getButtonStyle()
    clearBtn.onclick = () => this.clearSnapshots()

    leftButtons.appendChild(snapshotBtn)
    leftButtons.appendChild(autoBtn)
    leftButtons.appendChild(clearBtn)

    const rightButtons = document.createElement('div')
    rightButtons.style.cssText = 'display: flex; gap: 8px; align-items: center;'

    const exportBtn = document.createElement('button')
    exportBtn.textContent = '💾 Export'
    exportBtn.style.cssText = this.getButtonStyle()
    exportBtn.onclick = () => this.exportSnapshots()

    const importBtn = document.createElement('button')
    importBtn.textContent = '📂 Import'
    importBtn.style.cssText = this.getButtonStyle()
    importBtn.onclick = () => this.importSnapshots()

    rightButtons.appendChild(exportBtn)
    rightButtons.appendChild(importBtn)

    toolbar.appendChild(leftButtons)
    toolbar.appendChild(rightButtons)

    this.element!.appendChild(toolbar)
  }

  private createMainContent(): void {
    const content = document.createElement('div')
    content.style.cssText = `
      display: flex;
      flex: 1;
      overflow: hidden;
    `

    this.createSnapshotPanel(content)
    this.createDetailsPanel(content)

    this.element!.appendChild(content)
  }

  private createSnapshotPanel(parent: HTMLElement): void {
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
    prevBtn.style.cssText = this.getButtonStyle()
    prevBtn.onclick = () => this.goToPreviousSnapshot()

    const nextBtn = document.createElement('button')
    nextBtn.textContent = '⏭️'
    nextBtn.title = 'Next Snapshot'
    nextBtn.style.cssText = this.getButtonStyle()
    nextBtn.onclick = () => this.goToNextSnapshot()

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
    parent.appendChild(panel)
  }

  private createDetailsPanel(parent: HTMLElement): void {
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
      button.onclick = () => this.switchTab(tab.id)
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
    parent.appendChild(panel)

    this.showStateTab()
  }

  private getButtonStyle(bgColor = '#333'): string {
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

  private makeDraggable(header: HTMLElement): void {
    let isDragging = false
    let dragOffset = { x: 0, y: 0 }

    header.addEventListener('mousedown', (e) => {
      isDragging = true
      dragOffset.x = e.clientX - this.element!.offsetLeft
      dragOffset.y = e.clientY - this.element!.offsetTop
    })

    document.addEventListener('mousemove', (e) => {
      if (isDragging && this.element) {
        this.element.style.left = `${e.clientX - dragOffset.x}px`
        this.element.style.top = `${e.clientY - dragOffset.y}px`
        this.element.style.transform = 'none'
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
    })
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+B to toggle state debugger
      if (event.ctrlKey && event.shiftKey && event.key === 'B') {
        event.preventDefault()
        this.toggle()
      }

      if (this.isOpen) {
        // F8 to take snapshot
        if (event.key === 'F8') {
          event.preventDefault()
          this.takeSnapshot()
        }

        // Arrow keys for time travel
        if (event.altKey) {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            this.goToPreviousSnapshot()
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            this.goToNextSnapshot()
          }
        }
      }
    })
  }

  private startAutoSnapshot(): void {
    if (this.config.autoSnapshot) {
      this.autoSnapshotInterval = window.setInterval(() => {
        this.takeSnapshot()
      }, this.config.snapshotInterval)
    }
  }

  private stopAutoSnapshot(): void {
    if (this.autoSnapshotInterval) {
      clearInterval(this.autoSnapshotInterval)
      this.autoSnapshotInterval = null
    }
  }

  // Snapshot management
  public takeSnapshot(): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      entities: this.captureEntities(),
      components: this.captureComponents(),
      systems: this.captureSystems(),
      metadata: {
        frameNumber: 0, // Would get from game loop
        memoryUsage: this.getMemoryUsage(),
        entityCount: this.getEntityCount(),
        componentCount: this.getComponentCount(),
      },
    }

    this.snapshots.push(snapshot)

    // Limit snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift()
    }

    this.currentSnapshotIndex = this.snapshots.length - 1
    this.updateSnapshotList()
    this.updateSnapshotCounter()

    console.log(`📸 State snapshot taken: ${snapshot.id}`)
    return snapshot
  }

  private captureEntities(): Map<string, any> {
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

  private captureComponents(): Map<string, ComponentState> {
    const components = new Map()

    // Capture all tracked component states
    this.componentStates.forEach((state, id) => {
      components.set(id, { ...state })
    })

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

  private captureSystems(): Map<string, any> {
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

  private getMemoryUsage(): number {
    // @ts-ignore
    const memory = performance.memory
    return memory ? memory.usedJSHeapSize : 0
  }

  private getEntityCount(): number {
    // In a real implementation, get from world
    return 2 // Placeholder
  }

  private getComponentCount(): number {
    // In a real implementation, get from world
    return 4 // Placeholder
  }

  // Time travel debugging
  private goToPreviousSnapshot(): void {
    if (this.currentSnapshotIndex > 0) {
      this.currentSnapshotIndex--
      this.loadSnapshot(this.snapshots[this.currentSnapshotIndex])
      this.updateSnapshotSelection()
    }
  }

  private goToNextSnapshot(): void {
    if (this.currentSnapshotIndex < this.snapshots.length - 1) {
      this.currentSnapshotIndex++
      this.loadSnapshot(this.snapshots[this.currentSnapshotIndex])
      this.updateSnapshotSelection()
    }
  }

  private loadSnapshot(snapshot: StateSnapshot): void {
    console.log(`🕰️ Loading snapshot: ${snapshot.id}`)

    // In a real implementation, you would restore the world state
    // This is a placeholder that shows what would happen
    console.log('Restoring entities:', snapshot.entities)
    console.log('Restoring components:', snapshot.components)
    console.log('Restoring systems:', snapshot.systems)

    this.showStateTab()
  }

  // UI Updates
  private updateSnapshotList(): void {
    const list = document.getElementById('snapshot-list')
    if (!list) return

    list.innerHTML = ''

    this.snapshots.forEach((snapshot, index) => {
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 8px;
        margin-bottom: 4px;
        background: ${index === this.currentSnapshotIndex ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)'};
        border-radius: 4px;
        cursor: pointer;
        border-left: 3px solid ${index === this.currentSnapshotIndex ? '#ff6600' : 'transparent'};
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
        this.currentSnapshotIndex = index
        this.loadSnapshot(snapshot)
        this.updateSnapshotList()
        this.updateSnapshotSelection()
      }

      list.appendChild(item)
    })
  }

  private updateSnapshotCounter(): void {
    const counter = document.getElementById('snapshot-count')
    if (counter) {
      counter.textContent = `${this.snapshots.length} snapshots`
    }
  }

  private updateSnapshotSelection(): void {
    const indexDisplay = document.getElementById('current-snapshot-index')
    if (indexDisplay) {
      indexDisplay.textContent = `${this.currentSnapshotIndex + 1} / ${this.snapshots.length}`
    }
    this.updateSnapshotList()
  }

  // Tab management
  private switchTab(tabId: string): void {
    // Update tab buttons
    const tabs = this.element!.querySelectorAll('[id$="-tab"]')
    tabs.forEach((tab) => {
      const button = tab as HTMLElement
      const isActive = button.id === tabId
      button.style.background = isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
      button.style.color = isActive ? 'white' : '#888'
    })

    // Show tab content
    switch (tabId) {
      case 'state-tab':
        this.showStateTab()
        break
      case 'diff-tab':
        this.showDiffTab()
        break
      case 'watch-tab':
        this.showWatchTab()
        break
      case 'history-tab':
        this.showHistoryTab()
        break
    }
  }

  private showStateTab(): void {
    const content = document.getElementById('tab-content')
    if (!content) return

    if (this.snapshots.length === 0) {
      content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">No snapshots available<br>Take a snapshot to view state</div>'
      return
    }

    const snapshot = this.snapshots[this.currentSnapshotIndex]
    if (!snapshot) return

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Snapshot: ${new Date(snapshot.timestamp).toLocaleString()}</h3>
        <div style="color: #888; font-size: 10px;">
          ${snapshot.entities.size} entities • ${snapshot.components.size} components • ${(snapshot.metadata.memoryUsage / 1024 / 1024).toFixed(1)}MB
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <h4 style="color: #00ccff; margin: 0 0 8px 0;">Entities</h4>
          <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; max-height: 200px; overflow-y: auto;">
            ${Array.from(snapshot.entities.entries())
              .map(
                ([id, entity]) => `
              <div style="margin-bottom: 8px; padding: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px;">
                <div style="font-weight: bold;">${entity.name || id}</div>
                <div style="font-size: 10px; color: #888;">Components: ${entity.components?.join(', ') || 'None'}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
        
        <div>
          <h4 style="color: #00ccff; margin: 0 0 8px 0;">Components</h4>
          <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; max-height: 200px; overflow-y: auto;">
            ${Array.from(snapshot.components.entries())
              .map(
                ([_id, component]) => `
              <div style="margin-bottom: 8px; padding: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px;">
                <div style="font-weight: bold;">${component.type}</div>
                <div style="font-size: 10px; color: #888;">Entity: ${component.entityId}</div>
                <pre style="font-size: 9px; margin: 4px 0; color: #ccc; overflow: hidden;">${JSON.stringify(component.data, null, 2)}</pre>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `
  }

  private showDiffTab(): void {
    const content = document.getElementById('tab-content')
    if (!content) return

    if (this.snapshots.length < 2) {
      content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">Need at least 2 snapshots to show diffs</div>'
      return
    }

    // Calculate diff between current and previous snapshot
    const current = this.snapshots[this.currentSnapshotIndex]
    const previous = this.currentSnapshotIndex > 0 ? this.snapshots[this.currentSnapshotIndex - 1] : null

    if (!previous) {
      content.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">This is the first snapshot</div>'
      return
    }

    const diffs = this.calculateDiffs(previous, current)

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">State Diff</h3>
        <div style="color: #888; font-size: 10px;">
          ${new Date(previous.timestamp).toLocaleTimeString()} → ${new Date(current.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto;">
        ${diffs
          .map(
            (diff) => `
          <div style="margin-bottom: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; border-left: 3px solid ${this.getDiffColor(diff.type)};">
            <div style="font-weight: bold; color: ${this.getDiffColor(diff.type)};">${diff.type.toUpperCase()}: ${diff.path}</div>
            ${diff.oldValue !== undefined ? `<div style="font-size: 10px; color: #ff6666;">- ${JSON.stringify(diff.oldValue)}</div>` : ''}
            ${diff.newValue !== undefined ? `<div style="font-size: 10px; color: #66ff66;">+ ${JSON.stringify(diff.newValue)}</div>` : ''}
          </div>
        `,
          )
          .join('')}
      </div>
    `
  }

  private showWatchTab(): void {
    const content = document.getElementById('tab-content')
    if (!content) return

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Watch List</h3>
      </div>
      
      <div style="margin-bottom: 16px;">
        <h4 style="color: #00ccff; margin: 0 0 8px 0;">Watched Entities</h4>
        <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; min-height: 100px;">
          ${
            Array.from(this.watchedEntities)
              .map(
                (id) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
              <span>${id}</span>
              <button onclick="stateDebugger.unwatchEntity('${id}')" style="${this.getButtonStyle('#d33')}">Remove</button>
            </div>
          `,
              )
              .join('') || '<div style="color: #888; text-align: center;">No entities being watched</div>'
          }
        </div>
      </div>
      
      <div>
        <h4 style="color: #00ccff; margin: 0 0 8px 0;">Watched Components</h4>
        <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; min-height: 100px;">
          ${
            Array.from(this.watchedComponents)
              .map(
                (type) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
              <span>${type}</span>
              <button onclick="stateDebugger.unwatchComponent('${type}')" style="${this.getButtonStyle('#d33')}">Remove</button>
            </div>
          `,
              )
              .join('') || '<div style="color: #888; text-align: center;">No components being watched</div>'
          }
        </div>
      </div>
    `

    // Make debugger globally accessible for button callbacks
    const globalWithDebugger = globalThis as typeof globalThis & { stateDebugger?: StateDebugger }
    globalWithDebugger.stateDebugger = this
  }

  private showHistoryTab(): void {
    const content = document.getElementById('tab-content')
    if (!content) return

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff6600; margin: 0 0 8px 0;">Change History</h3>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto;">
        ${
          this.stateDiffs
            .slice(-50)
            .reverse()
            .map(
              (diff) => `
          <div style="margin-bottom: 6px; padding: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px; border-left: 2px solid ${this.getDiffColor(diff.type)};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; color: ${this.getDiffColor(diff.type)};">${diff.type.toUpperCase()}</span>
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
  }

  private calculateDiffs(previous: StateSnapshot, current: StateSnapshot): StateDiff[] {
    const diffs: StateDiff[] = []

    // Compare entities
    current.entities.forEach((entity, id) => {
      const prevEntity = previous.entities.get(id)
      if (!prevEntity) {
        diffs.push({
          type: 'added',
          path: `entities.${id}`,
          newValue: entity,
          timestamp: current.timestamp,
        })
      } else if (JSON.stringify(entity) !== JSON.stringify(prevEntity)) {
        diffs.push({
          type: 'modified',
          path: `entities.${id}`,
          oldValue: prevEntity,
          newValue: entity,
          timestamp: current.timestamp,
        })
      }
    })

    previous.entities.forEach((entity, id) => {
      if (!current.entities.has(id)) {
        diffs.push({
          type: 'removed',
          path: `entities.${id}`,
          oldValue: entity,
          timestamp: current.timestamp,
        })
      }
    })

    // Compare components
    current.components.forEach((component, id) => {
      const prevComponent = previous.components.get(id)
      if (!prevComponent) {
        diffs.push({
          type: 'added',
          path: `components.${id}`,
          newValue: component,
          timestamp: current.timestamp,
        })
      } else if (JSON.stringify(component.data) !== JSON.stringify(prevComponent.data)) {
        diffs.push({
          type: 'modified',
          path: `components.${id}.data`,
          oldValue: prevComponent.data,
          newValue: component.data,
          timestamp: current.timestamp,
        })
      }
    })

    return diffs
  }

  private getDiffColor(type: string): string {
    switch (type) {
      case 'added':
        return '#66ff66'
      case 'removed':
        return '#ff6666'
      case 'modified':
        return '#ffaa00'
      default:
        return '#cccccc'
    }
  }

  // Watch functionality
  public watchEntity(entityId: string): void {
    this.watchedEntities.add(entityId)
    console.log(`👁️ Watching entity: ${entityId}`)
  }

  public unwatchEntity(entityId: string): void {
    this.watchedEntities.delete(entityId)
    console.log(`👁️ Stopped watching entity: ${entityId}`)
    this.showWatchTab() // Refresh the watch tab
  }

  public watchComponent(componentType: string): void {
    this.watchedComponents.add(componentType)
    console.log(`👁️ Watching component type: ${componentType}`)
  }

  public unwatchComponent(componentType: string): void {
    this.watchedComponents.delete(componentType)
    console.log(`👁️ Stopped watching component type: ${componentType}`)
    this.showWatchTab() // Refresh the watch tab
  }

  // Auto snapshot
  private toggleAutoSnapshot(): void {
    this.config.autoSnapshot = !this.config.autoSnapshot

    const button = document.getElementById('auto-snapshot-btn')
    if (button) {
      button.style.background = this.config.autoSnapshot ? '#28a745' : '#333'
    }

    if (this.config.autoSnapshot) {
      this.startAutoSnapshot()
    } else {
      this.stopAutoSnapshot()
    }

    console.log(`🔄 Auto snapshot ${this.config.autoSnapshot ? 'enabled' : 'disabled'}`)
  }

  // Data management
  private clearSnapshots(): void {
    if (confirm('Are you sure you want to clear all snapshots?')) {
      this.snapshots = []
      this.currentSnapshotIndex = -1
      this.updateSnapshotList()
      this.updateSnapshotCounter()
      this.updateSnapshotSelection()
      console.log('🧹 All snapshots cleared')
    }
  }

  private exportSnapshots(): void {
    const exportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      config: this.config,
      snapshots: this.snapshots,
      watchedEntities: Array.from(this.watchedEntities),
      watchedComponents: Array.from(this.watchedComponents),
      stateDiffs: this.stateDiffs,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `state-debug-session-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    console.log('💾 State debug session exported')
  }

  private importSnapshots(): void {
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
            this.snapshots = data.snapshots || []
            this.watchedEntities = new Set(data.watchedEntities || [])
            this.watchedComponents = new Set(data.watchedComponents || [])
            this.stateDiffs = data.stateDiffs || []
            this.currentSnapshotIndex = this.snapshots.length - 1

            this.updateSnapshotList()
            this.updateSnapshotCounter()
            this.updateSnapshotSelection()

            console.log('📂 State debug session imported')
          } catch (error) {
            console.error('Failed to import session:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  // Public API
  public open(): void {
    this.isOpen = true
    if (this.element) {
      this.element.style.display = 'flex'
    }
  }

  public close(): void {
    this.isOpen = false
    if (this.element) {
      this.element.style.display = 'none'
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public updateConfig(newConfig: Partial<StateDebuggerConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (this.config.autoSnapshot) {
      this.startAutoSnapshot()
    } else {
      this.stopAutoSnapshot()
    }
  }

  public getSnapshots(): StateSnapshot[] {
    return [...this.snapshots]
  }

  public destroy(): void {
    this.close()
    this.stopAutoSnapshot()

    if (this.element) {
      document.body.removeChild(this.element)
      this.element = null
    }

    console.log('🔬 State Debugger destroyed')
  }
}
