import { World } from '../core/entities/entity'

export interface WorldEditAction {
  type: 'place' | 'remove' | 'replace'
  position: { x: number; y: number; z: number }
  blockType?: string
  oldBlockType?: string
}

export class WorldEditor {
  private isOpen: boolean = false
  private editorElement: HTMLElement | null = null
  private selectedTool: string = 'place'
  private selectedBlockType: string = 'stone'
  private actionHistory: WorldEditAction[] = []
  private historyIndex: number = -1

  constructor(private world: World) {
    if (import.meta.env.DEV) {
      this.createEditorUI()
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    this.isOpen = true
    if (this.editorElement) {
      this.editorElement.style.display = 'block'
    }
    console.log('🏗️ World Editor opened')
  }

  close(): void {
    this.isOpen = false
    if (this.editorElement) {
      this.editorElement.style.display = 'none'
    }
    console.log('🏗️ World Editor closed')
  }

  private createEditorUI(): void {
    this.editorElement = document.createElement('div')
    this.editorElement.id = 'world-editor'
    this.editorElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 420px;
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

    this.editorElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #0cf;">
        🏗️ World Editor
        <button onclick="this.parentElement.parentElement.style.display='none'" 
                style="float: right; background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;">✕</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label>Tool:</label>
        <select id="tool-select" style="margin-left: 5px; background: #333; color: white; border: 1px solid #555;">
          <option value="place">Place Block</option>
          <option value="remove">Remove Block</option>
          <option value="replace">Replace Block</option>
        </select>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label>Block Type:</label>
        <select id="block-select" style="margin-left: 5px; background: #333; color: white; border: 1px solid #555;">
          <option value="stone">Stone</option>
          <option value="grass">Grass</option>
          <option value="dirt">Dirt</option>
          <option value="wood">Wood</option>
          <option value="sand">Sand</option>
          <option value="water">Water</option>
          <option value="air">Air</option>
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
        <div>Actions: <span id="action-count">${this.actionHistory.length}</span></div>
        <div>History Index: <span id="history-index">${this.historyIndex}</span></div>
      </div>
    `

    document.body.appendChild(this.editorElement)
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // ツール選択
    const toolSelect = this.editorElement?.querySelector('#tool-select') as HTMLSelectElement
    if (toolSelect) {
      toolSelect.addEventListener('change', (e) => {
        this.selectedTool = (e.target as HTMLSelectElement).value
      })
    }

    // ブロックタイプ選択
    const blockSelect = this.editorElement?.querySelector('#block-select') as HTMLSelectElement
    if (blockSelect) {
      blockSelect.addEventListener('change', (e) => {
        this.selectedBlockType = (e.target as HTMLSelectElement).value
      })
    }

    // フィル機能
    const fillButton = this.editorElement?.querySelector('#fill-button')
    if (fillButton) {
      fillButton.addEventListener('click', () => this.fillSelectedArea())
    }

    // アンドゥ・リドゥ
    const undoButton = this.editorElement?.querySelector('#undo-button')
    const redoButton = this.editorElement?.querySelector('#redo-button')
    
    if (undoButton) {
      undoButton.addEventListener('click', () => this.undo())
    }
    
    if (redoButton) {
      redoButton.addEventListener('click', () => this.redo())
    }

    // キーボードショートカット
    document.addEventListener('keydown', (event) => {
      if (!this.isOpen) return

      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault()
          this.undo()
        } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault()
          this.redo()
        }
      }
    })

    // マウス操作（簡易実装）
    document.addEventListener('mousedown', (event) => {
      if (!this.isOpen) return
      this.handleMouseClick(event)
    })
  }

  private handleMouseClick(event: MouseEvent): void {
    // レイキャストでワールド座標を取得（実装依存）
    const worldPos = this.getWorldPositionFromMouse(event)
    if (!worldPos) return

    this.executeAction(this.selectedTool, worldPos)
  }

  private getWorldPositionFromMouse(_event: MouseEvent): { x: number; y: number; z: number } | null {
    // 実際の実装では、Three.jsのレイキャスターを使用してワールド座標を取得
    // プレースホルダー実装
    return { x: 0, y: 0, z: 0 }
  }

  private executeAction(tool: string, position: { x: number; y: number; z: number }): void {
    const action: WorldEditAction = {
      type: tool as any,
      position
    }

    switch (tool) {
      case 'place':
        action.blockType = this.selectedBlockType
        this.placeBlock(position, this.selectedBlockType)
        break
      case 'remove':
        action.oldBlockType = this.getBlockAt(position)
        this.removeBlock(position)
        break
      case 'replace':
        action.oldBlockType = this.getBlockAt(position)
        action.blockType = this.selectedBlockType
        this.replaceBlock(position, this.selectedBlockType)
        break
    }

    this.addToHistory(action)
    this.updateUI()
  }

  private placeBlock(position: { x: number; y: number; z: number }, blockType: string): void {
    console.log(`Placing ${blockType} at (${position.x}, ${position.y}, ${position.z})`)
    // 実際のブロック配置処理
  }

  private removeBlock(position: { x: number; y: number; z: number }): void {
    console.log(`Removing block at (${position.x}, ${position.y}, ${position.z})`)
    // 実際のブロック削除処理
  }

  private replaceBlock(position: { x: number; y: number; z: number }, blockType: string): void {
    console.log(`Replacing block at (${position.x}, ${position.y}, ${position.z}) with ${blockType}`)
    // 実際のブロック置換処理
  }

  private getBlockAt(_position: { x: number; y: number; z: number }): string {
    // 実際の実装では、ワールドからブロックタイプを取得
    return 'air'
  }

  private fillSelectedArea(): void {
    console.log(`Filling selected area with ${this.selectedBlockType}`)
    // 選択された領域をフィルする処理
    // 実際の実装では、選択範囲を取得して一括処理
  }

  private addToHistory(action: WorldEditAction): void {
    // 現在の位置より後の履歴を削除
    if (this.historyIndex < this.actionHistory.length - 1) {
      this.actionHistory.splice(this.historyIndex + 1)
    }

    this.actionHistory.push(action)
    this.historyIndex = this.actionHistory.length - 1

    // 履歴サイズを制限
    if (this.actionHistory.length > 1000) {
      this.actionHistory.shift()
      this.historyIndex--
    }
  }

  private undo(): void {
    if (this.historyIndex < 0) return

    const action = this.actionHistory[this.historyIndex]
    this.revertAction(action)
    this.historyIndex--
    this.updateUI()
    
    console.log('🔄 Undo action:', action)
  }

  private redo(): void {
    if (this.historyIndex >= this.actionHistory.length - 1) return

    this.historyIndex++
    const action = this.actionHistory[this.historyIndex]
    this.applyAction(action)
    this.updateUI()
    
    console.log('🔄 Redo action:', action)
  }

  private revertAction(action: WorldEditAction): void {
    switch (action.type) {
      case 'place':
        this.removeBlock(action.position)
        break
      case 'remove':
        if (action.oldBlockType) {
          this.placeBlock(action.position, action.oldBlockType)
        }
        break
      case 'replace':
        if (action.oldBlockType) {
          this.replaceBlock(action.position, action.oldBlockType)
        }
        break
    }
  }

  private applyAction(action: WorldEditAction): void {
    switch (action.type) {
      case 'place':
        if (action.blockType) {
          this.placeBlock(action.position, action.blockType)
        }
        break
      case 'remove':
        this.removeBlock(action.position)
        break
      case 'replace':
        if (action.blockType) {
          this.replaceBlock(action.position, action.blockType)
        }
        break
    }
  }

  private updateUI(): void {
    const actionCountEl = this.editorElement?.querySelector('#action-count')
    const historyIndexEl = this.editorElement?.querySelector('#history-index')
    
    if (actionCountEl) {
      actionCountEl.textContent = this.actionHistory.length.toString()
    }
    
    if (historyIndexEl) {
      historyIndexEl.textContent = this.historyIndex.toString()
    }
  }

  // 公開API
  clearHistory(): void {
    this.actionHistory = []
    this.historyIndex = -1
    this.updateUI()
    console.log('🧹 World editor history cleared')
  }

  exportWorld(): any {
    console.log('💾 Exporting world data...')
    // ワールドデータをエクスポートする処理
    return {
      timestamp: Date.now(),
      actions: this.actionHistory.length,
      message: 'World export feature not implemented yet'
    }
  }

  importWorld(data: any): void {
    console.log('📁 Importing world data...', data)
    // ワールドデータをインポートする処理
  }

  getStats(): any {
    return {
      totalActions: this.actionHistory.length,
      currentHistoryIndex: this.historyIndex,
      selectedTool: this.selectedTool,
      selectedBlockType: this.selectedBlockType,
      canUndo: this.historyIndex >= 0,
      canRedo: this.historyIndex < this.actionHistory.length - 1
    }
  }
}

// Factory function for compatibility
export const createWorldEditor = (world: World): WorldEditor => {
  return new WorldEditor(world)
}