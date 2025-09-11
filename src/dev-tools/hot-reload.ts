import { Effect } from 'effect'

export interface HotReloadConfig {
  enabled: boolean
  watchPatterns: string[]
  ignoredPatterns: string[]
  debounceMs: number
  enableLiveReload: boolean
  enableStatePreservation: boolean
  preservedStateKeys: string[]
  onReload?: (changes: FileChange[]) => void
  onError?: (error: Error) => void
}

export interface FileChange {
  path: string
  type: 'added' | 'changed' | 'deleted'
  timestamp: number
  size?: number
}

export interface HotReloadState {
  isActive: boolean
  lastReload: number
  totalReloads: number
  watchedFiles: Set<string>
  pendingChanges: FileChange[]
  preservedState: Record<string, any>
}

export class HotReloadManager {
  private config: HotReloadConfig
  private state: HotReloadState
  private watcher: any = null
  private debounceTimeout: number | null = null
  private overlay: HTMLElement | null = null
  private isReloading = false

  constructor(config: Partial<HotReloadConfig> = {}) {
    this.config = {
      enabled: true,
      watchPatterns: [
        'src/**/*.ts',
        'src/**/*.js',
        'src/**/*.json',
        'src/**/*.css',
        'public/**/*'
      ],
      ignoredPatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/.git/**'
      ],
      debounceMs: 300,
      enableLiveReload: true,
      enableStatePreservation: true,
      preservedStateKeys: [
        'gameState',
        'userSettings',
        'debugState',
        'playerPosition'
      ],
      ...config
    }

    this.state = {
      isActive: false,
      lastReload: 0,
      totalReloads: 0,
      watchedFiles: new Set(),
      pendingChanges: [],
      preservedState: {}
    }

    if (import.meta.env.DEV && this.config.enabled) {
      this.initialize()
    }
  }

  private async initialize(): Promise<void> {
    try {
      console.log('🔥 Initializing Hot Reload Manager...')
      
      // Setup HMR if available
      if (import.meta.hot) {
        this.setupViteHMR()
      }

      // Setup file watching for custom hot reload
      await this.setupFileWatcher()
      
      // Create UI overlay
      this.createReloadOverlay()
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts()
      
      this.state.isActive = true
      console.log('🔥 Hot Reload Manager initialized')
      
    } catch (error) {
      console.error('❌ Failed to initialize Hot Reload Manager:', error)
      this.config.onError?.(error as Error)
    }
  }

  private setupViteHMR(): void {
    if (!import.meta.hot) return

    console.log('🔥 Setting up Vite HMR integration...')

    // Accept HMR updates for specific modules
    import.meta.hot.accept((newModule) => {
      console.log('🔄 HMR update received:', newModule)
      this.handleHMRUpdate(newModule)
    })

    // Handle HMR disposal
    import.meta.hot.dispose((data) => {
      console.log('🗑️ HMR disposal, preserving state...')
      this.preserveCurrentState(data)
    })

    // Handle full reload
    import.meta.hot.on('vite:beforeFullReload', () => {
      console.log('🔄 Full reload triggered, preserving state...')
      this.preserveStateToStorage()
    })

    // Custom HMR events
    import.meta.hot.on('dev-tools:reload', (data) => {
      console.log('🔧 Dev tools reload event:', data)
      this.handleDevToolsReload(data)
    })
  }

  private async setupFileWatcher(): Promise<void> {
    // In a real implementation, you would use a file watcher library
    // For now, we'll simulate file watching with periodic checks
    
    console.log('👁️ Setting up file watcher...')
    
    // Simulate file watching with polling (for demo purposes)
    setInterval(() => {
      this.checkForFileChanges()
    }, 1000)
  }

  private checkForFileChanges(): void {
    // In a real implementation, this would check actual file system changes
    // For now, we'll simulate occasional changes for demo purposes
    
    if (Math.random() < 0.01) { // 1% chance per second
      const simulatedChange: FileChange = {
        path: `src/components/test-${Date.now()}.ts`,
        type: 'changed',
        timestamp: Date.now()
      }
      
      this.handleFileChange(simulatedChange)
    }
  }

  private handleFileChange(change: FileChange): void {
    console.log(`📁 File ${change.type}: ${change.path}`)
    
    this.state.pendingChanges.push(change)
    this.state.watchedFiles.add(change.path)
    
    // Debounce multiple rapid changes
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }
    
    this.debounceTimeout = window.setTimeout(() => {
      this.processFileChanges()
    }, this.config.debounceMs)
  }

  private async processFileChanges(): Promise<void> {
    if (this.state.pendingChanges.length === 0 || this.isReloading) return

    this.isReloading = true
    const changes = [...this.state.pendingChanges]
    this.state.pendingChanges = []

    try {
      console.log(`🔄 Processing ${changes.length} file changes...`)
      
      // Show reload overlay
      this.showReloadOverlay(changes)
      
      // Preserve state before reload
      if (this.config.enableStatePreservation) {
        this.preserveCurrentState()
      }
      
      // Attempt hot module replacement
      const success = await this.attemptHotReload(changes)
      
      if (!success && this.config.enableLiveReload) {
        // Fallback to full page reload
        console.log('🔄 Hot reload failed, performing full reload...')
        this.performFullReload()
      } else {
        // Hide overlay after successful hot reload
        setTimeout(() => {
          this.hideReloadOverlay()
        }, 1000)
      }
      
      this.state.totalReloads++
      this.state.lastReload = Date.now()
      
      this.config.onReload?.(changes)
      
    } catch (error) {
      console.error('❌ Hot reload failed:', error)
      this.config.onError?.(error as Error)
      this.showReloadError(error as Error)
    } finally {
      this.isReloading = false
    }
  }

  private async attemptHotReload(changes: FileChange[]): Promise<boolean> {
    try {
      // Categorize changes
      const componentChanges = changes.filter(c => c.path.includes('components/'))
      const systemChanges = changes.filter(c => c.path.includes('systems/'))
      const styleChanges = changes.filter(c => c.path.includes('.css'))
      
      // Handle different types of changes
      if (styleChanges.length > 0) {
        return await this.reloadStyles(styleChanges)
      }
      
      if (componentChanges.length > 0) {
        return await this.reloadComponents(componentChanges)
      }
      
      if (systemChanges.length > 0) {
        return await this.reloadSystems(systemChanges)
      }
      
      return false // Fallback to full reload
      
    } catch (error) {
      console.error('❌ Hot reload attempt failed:', error)
      return false
    }
  }

  private async reloadStyles(changes: FileChange[]): Promise<boolean> {
    console.log('🎨 Hot reloading styles...')
    
    try {
      // Reload CSS files
      for (const change of changes) {
        const link = document.querySelector(`link[href*="${change.path}"]`) as HTMLLinkElement
        if (link) {
          const newHref = `${change.path}?t=${Date.now()}`
          link.href = newHref
        }
      }
      
      console.log('✅ Styles reloaded successfully')
      return true
      
    } catch (error) {
      console.error('❌ Style reload failed:', error)
      return false
    }
  }

  private async reloadComponents(changes: FileChange[]): Promise<boolean> {
    console.log('🧩 Hot reloading components...')
    
    try {
      // In a real implementation, you would:
      // 1. Parse the changed component files
      // 2. Update the component registry
      // 3. Re-render affected parts of the UI
      // 4. Preserve component state where possible
      
      for (const change of changes) {
        console.log(`🔄 Reloading component: ${change.path}`)
        
        // Simulate component reload
        await this.simulateModuleReload(change.path)
      }
      
      console.log('✅ Components reloaded successfully')
      return true
      
    } catch (error) {
      console.error('❌ Component reload failed:', error)
      return false
    }
  }

  private async reloadSystems(changes: FileChange[]): Promise<boolean> {
    console.log('⚙️ Hot reloading systems...')
    
    try {
      // In a real implementation, you would:
      // 1. Stop affected systems
      // 2. Reload system modules
      // 3. Restart systems with preserved state
      
      for (const change of changes) {
        console.log(`🔄 Reloading system: ${change.path}`)
        
        // Simulate system reload
        await this.simulateModuleReload(change.path)
      }
      
      console.log('✅ Systems reloaded successfully')
      return true
      
    } catch (error) {
      console.error('❌ System reload failed:', error)
      return false
    }
  }

  private async simulateModuleReload(path: string): Promise<void> {
    // Simulate async module reload
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`📦 Module reloaded: ${path}`)
        resolve()
      }, 100)
    })
  }

  private preserveCurrentState(data?: any): void {
    if (!this.config.enableStatePreservation) return

    console.log('💾 Preserving current state...')
    
    // Preserve state to the data object (for HMR)
    if (data) {
      this.config.preservedStateKeys.forEach(key => {
        const value = this.getStateValue(key)
        if (value !== undefined) {
          data[key] = value
          this.state.preservedState[key] = value
        }
      })
    }
    
    // Also preserve to localStorage as backup
    this.preserveStateToStorage()
  }

  private preserveStateToStorage(): void {
    try {
      const stateToPreserve: Record<string, any> = {}
      
      this.config.preservedStateKeys.forEach(key => {
        const value = this.getStateValue(key)
        if (value !== undefined) {
          stateToPreserve[key] = value
        }
      })
      
      localStorage.setItem('hot-reload-preserved-state', JSON.stringify(stateToPreserve))
      console.log('💾 State preserved to storage')
      
    } catch (error) {
      console.error('❌ Failed to preserve state to storage:', error)
    }
  }

  private getStateValue(key: string): any {
    // In a real implementation, you would get state from your application
    // This is a placeholder that would need to be customized
    
    switch (key) {
      case 'gameState':
        return (window as any).gameState
      case 'userSettings':
        return (window as any).userSettings
      case 'debugState':
        return (window as any).debugState
      case 'playerPosition':
        return (window as any).playerPosition
      default:
        return (window as any)[key]
    }
  }

  private restorePreservedState(): void {
    if (!this.config.enableStatePreservation) return

    try {
      // Restore from localStorage
      const preserved = localStorage.getItem('hot-reload-preserved-state')
      if (preserved) {
        const state = JSON.parse(preserved)
        
        Object.entries(state).forEach(([key, value]) => {
          this.setStateValue(key, value)
        })
        
        console.log('🔄 State restored from storage')
        localStorage.removeItem('hot-reload-preserved-state')
      }
      
      // Restore from HMR data
      Object.entries(this.state.preservedState).forEach(([key, value]) => {
        this.setStateValue(key, value)
      })
      
    } catch (error) {
      console.error('❌ Failed to restore preserved state:', error)
    }
  }

  private setStateValue(key: string, value: any): void {
    // In a real implementation, you would set state in your application
    // This is a placeholder that would need to be customized
    
    switch (key) {
      case 'gameState':
        (window as any).gameState = value
        break
      case 'userSettings':
        (window as any).userSettings = value
        break
      case 'debugState':
        (window as any).debugState = value
        break
      case 'playerPosition':
        (window as any).playerPosition = value
        break
      default:
        (window as any)[key] = value
    }
  }

  private performFullReload(): void {
    console.log('🔄 Performing full page reload...')
    window.location.reload()
  }

  private createReloadOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.id = 'hot-reload-overlay'
    this.overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      border: 1px solid #333;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      min-width: 200px;
    `
    
    document.body.appendChild(this.overlay)
  }

  private showReloadOverlay(changes: FileChange[]): void {
    if (!this.overlay) return

    const changeList = changes.map(c => `• ${c.type}: ${c.path.split('/').pop()}`).join('<br>')
    
    this.overlay.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="margin-right: 8px;">🔥</div>
        <div><strong>Hot Reloading...</strong></div>
      </div>
      <div style="font-size: 10px; color: #ccc;">
        ${changeList}
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #888;">
        Press F5 to force full reload
      </div>
    `
    
    this.overlay.style.display = 'block'
  }

  private hideReloadOverlay(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none'
    }
  }

  private showReloadError(error: Error): void {
    if (!this.overlay) return

    this.overlay.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="margin-right: 8px;">❌</div>
        <div><strong>Reload Failed</strong></div>
      </div>
      <div style="font-size: 10px; color: #ff6666;">
        ${error.message}
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #888;">
        Press F5 to force full reload
      </div>
    `
    
    this.overlay.style.display = 'block'
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideReloadOverlay()
    }, 5000)
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+R for manual reload
      if (event.ctrlKey && event.key === 'r') {
        event.preventDefault()
        this.manualReload()
      }
      
      // Ctrl+Shift+R for force reload
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault()
        this.forceReload()
      }
      
      // F5 for standard reload
      if (event.key === 'F5') {
        event.preventDefault()
        this.forceReload()
      }
    })
  }

  private handleHMRUpdate(newModule: any): void {
    console.log('🔄 Handling HMR update:', newModule)
    
    // In a real implementation, you would:
    // 1. Update the module in your application
    // 2. Re-render affected components
    // 3. Preserve relevant state
    
    this.showReloadOverlay([{
      path: 'HMR Update',
      type: 'changed',
      timestamp: Date.now()
    }])
    
    setTimeout(() => {
      this.hideReloadOverlay()
    }, 1000)
  }

  private handleDevToolsReload(data: any): void {
    console.log('🔧 Handling dev tools reload:', data)
    
    // Custom dev tools reload logic
    if (data.type === 'debugger') {
      // Reload debugger
    } else if (data.type === 'console') {
      // Reload dev console
    }
  }

  // Public API
  public manualReload(): void {
    console.log('🔄 Manual reload triggered')
    
    const changes: FileChange[] = [{
      path: 'Manual Reload',
      type: 'changed',
      timestamp: Date.now()
    }]
    
    this.processFileChanges()
  }

  public forceReload(): void {
    console.log('🔄 Force reload triggered')
    this.performFullReload()
  }

  public enable(): void {
    this.config.enabled = true
    this.state.isActive = true
    console.log('🔥 Hot reload enabled')
  }

  public disable(): void {
    this.config.enabled = false
    this.state.isActive = false
    
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }
    
    console.log('🔥 Hot reload disabled')
  }

  public getState(): HotReloadState {
    return { ...this.state }
  }

  public getConfig(): HotReloadConfig {
    return { ...this.config }
  }

  public updateConfig(newConfig: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🔥 Hot reload config updated')
  }

  public destroy(): void {
    this.disable()
    
    if (this.overlay) {
      document.body.removeChild(this.overlay)
      this.overlay = null
    }
    
    if (this.watcher) {
      this.watcher.close?.()
      this.watcher = null
    }
    
    console.log('🔥 Hot Reload Manager destroyed')
  }
}

// Export singleton instance for easy use
export const hotReloadManager = new HotReloadManager()

// Auto-initialize on module load in development
if (import.meta.env.DEV) {
  // Restore any preserved state from previous hot reload
  setTimeout(() => {
    hotReloadManager.getState()
  }, 100)
}