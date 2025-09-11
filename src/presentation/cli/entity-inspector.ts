import { World } from '@/domain/entities'

export interface EntityInfo {
  id: string
  name: string
  components: any[]
  position?: { x: number; y: number; z: number }
  active: boolean
}

export class EntityInspector {
  private isOpen: boolean = false
  private inspectorElement: HTMLElement | null = null
  private entityListElement: HTMLElement | null = null
  private detailsElement: HTMLElement | null = null
  private searchElement: HTMLInputElement | null = null
  private selectedEntityId: string | null = null
  private updateInterval: number | null = null

  constructor(private world: World) {
    if (import.meta.env.DEV) {
      this.createInspectorUI()
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
    if (this.inspectorElement) {
      this.inspectorElement.style.display = 'flex'
      this.refreshEntityList()
      this.startAutoRefresh()
    }
    console.log('🔍 Entity Inspector opened')
  }

  close(): void {
    this.isOpen = false
    if (this.inspectorElement) {
      this.inspectorElement.style.display = 'none'
      this.stopAutoRefresh()
    }
    console.log('🔍 Entity Inspector closed')
  }

  private createInspectorUI(): void {
    this.inspectorElement = document.createElement('div')
    this.inspectorElement.id = 'entity-inspector'
    this.inspectorElement.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      width: 600px;
      height: 500px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #333;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 10001;
      display: none;
      flex-direction: column;
    `

    this.createHeader()
    this.createContent()

    document.body.appendChild(this.inspectorElement)
    this.setupEventListeners()
  }

  private createHeader(): void {
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
    refreshButton.onclick = () => this.refreshEntityList()

    const closeButton = document.createElement('button')
    closeButton.textContent = '✕'
    closeButton.style.cssText = 'background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
    closeButton.onclick = () => this.close()

    controls.appendChild(refreshButton)
    controls.appendChild(closeButton)

    header.appendChild(title)
    header.appendChild(controls)

    this.inspectorElement!.appendChild(header)
  }

  private createContent(): void {
    const content = document.createElement('div')
    content.style.cssText = `
      display: flex;
      flex: 1;
      min-height: 0;
    `

    // 左パネル: エンティティリスト
    const leftPanel = document.createElement('div')
    leftPanel.style.cssText = `
      width: 250px;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
    `

    // 検索ボックス
    this.searchElement = document.createElement('input')
    this.searchElement.type = 'text'
    this.searchElement.placeholder = 'Search entities...'
    this.searchElement.style.cssText = `
      background: #222;
      border: 1px solid #444;
      color: #fff;
      padding: 5px;
      margin: 5px;
      border-radius: 3px;
      outline: none;
    `

    this.entityListElement = document.createElement('div')
    this.entityListElement.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 5px;
    `

    leftPanel.appendChild(this.searchElement)
    leftPanel.appendChild(this.entityListElement)

    // 右パネル: 詳細表示
    this.detailsElement = document.createElement('div')
    this.detailsElement.style.cssText = `
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      color: #fff;
    `

    content.appendChild(leftPanel)
    content.appendChild(this.detailsElement)

    this.inspectorElement!.appendChild(content)
  }

  private setupEventListeners(): void {
    // 検索機能
    this.searchElement?.addEventListener('input', () => {
      this.filterEntityList()
    })

    // ドラッグ機能（簡易版）
    let isDragging = false
    let dragOffsetX = 0
    let dragOffsetY = 0

    const header = this.inspectorElement!.querySelector('div') as HTMLElement
    header.style.cursor = 'move'

    header.addEventListener('mousedown', (e) => {
      isDragging = true
      dragOffsetX = e.clientX - this.inspectorElement!.offsetLeft
      dragOffsetY = e.clientY - this.inspectorElement!.offsetTop
    })

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.inspectorElement!.style.left = `${e.clientX - dragOffsetX}px`
        this.inspectorElement!.style.top = `${e.clientY - dragOffsetY}px`
        this.inspectorElement!.style.right = 'auto'
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
    })
  }

  private refreshEntityList(): void {
    if (!this.entityListElement) return

    // エンティティリストをクリア
    this.entityListElement.innerHTML = ''

    // 実際のエンティティを取得（実装依存）
    const entities = this.getEntities()

    entities.forEach((entity) => {
      const entityElement = document.createElement('div')
      entityElement.style.cssText = `
        padding: 5px;
        margin: 2px;
        background: ${entity.id === this.selectedEntityId ? '#444' : '#222'};
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

      entityElement.onclick = () => {
        this.selectEntity(entity.id)
      }

      this.entityListElement.appendChild(entityElement)
    })
  }

  private filterEntityList(): void {
    const searchTerm = this.searchElement?.value.toLowerCase() || ''
    const entityElements = this.entityListElement?.children

    if (!entityElements) return

    for (let i = 0; i < entityElements.length; i++) {
      const element = entityElements[i] as HTMLElement
      const text = element.textContent?.toLowerCase() || ''
      element.style.display = text.includes(searchTerm) ? 'block' : 'none'
    }
  }

  private selectEntity(entityId: string): void {
    this.selectedEntityId = entityId
    this.refreshEntityList()
    this.displayEntityDetails(entityId)
  }

  private displayEntityDetails(entityId: string): void {
    if (!this.detailsElement) return

    const entity = this.getEntityById(entityId)
    if (!entity) {
      this.detailsElement.innerHTML = '<div style="color: #f00;">Entity not found</div>'
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

    // コンポーネント表示
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

    // エンティティ操作ボタン
    html += `
      <div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;">
        <h4 style="color: #0cf; margin: 0 0 10px 0;">Actions</h4>
        <button onclick="window.entityInspector.deleteEntity('${entity.id}')" style="background: #d33; border: none; color: white; padding: 5px 10px; margin-right: 5px; border-radius: 3px; cursor: pointer;">Delete Entity</button>
        <button onclick="window.entityInspector.toggleEntity('${entity.id}')" style="background: #555; border: none; color: white; padding: 5px 10px; margin-right: 5px; border-radius: 3px; cursor: pointer;">${entity.active ? 'Deactivate' : 'Activate'}</button>
        <button onclick="window.entityInspector.cloneEntity('${entity.id}')" style="background: #3a3; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Clone</button>
      </div>
    `

    this.detailsElement.innerHTML = html

    // グローバルに公開（ボタンから呼び出すため）
    const globalWithEntityInspector = globalThis as typeof globalThis & { entityInspector?: EntityInspector }
    globalWithEntityInspector.entityInspector = this
  }

  private startAutoRefresh(): void {
    this.updateInterval = window.setInterval(() => {
      if (this.isOpen) {
        this.refreshEntityList()
        if (this.selectedEntityId) {
          this.displayEntityDetails(this.selectedEntityId)
        }
      }
    }, 1000) // 1秒ごとに更新
  }

  private stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  // 実装に依存するメソッド（プレースホルダー）
  private getEntities(): EntityInfo[] {
    // 実際の実装では、World からエンティティを取得
    return [
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
    ]
  }

  private getEntityById(id: string): EntityInfo | null {
    return this.getEntities().find((e) => e.id === id) || null
  }

  // エンティティ操作メソッド
  deleteEntity(id: string): void {
    console.log(`🗑️ Deleting entity: ${id}`)
    // 実際の削除処理
    this.refreshEntityList()
    if (this.selectedEntityId === id) {
      this.selectedEntityId = null
      this.detailsElement!.innerHTML = '<div style="color: #888;">Select an entity to view details</div>'
    }
  }

  toggleEntity(id: string): void {
    console.log(`🔄 Toggling entity: ${id}`)
    // 実際の有効/無効切り替え処理
    this.refreshEntityList()
    this.displayEntityDetails(id)
  }

  cloneEntity(id: string): void {
    console.log(`📋 Cloning entity: ${id}`)
    // 実際のクローン処理
    this.refreshEntityList()
  }

  // 外部から呼び出し可能なメソッド
  inspectEntity(id: string): void {
    if (!this.isOpen) {
      this.open()
    }
    this.selectEntity(id)
  }

  // エンティティ検索機能
  findEntitiesByComponent(componentType: string): EntityInfo[] {
    return this.getEntities().filter((entity) => entity.components.some((comp) => comp.type === componentType))
  }

  // エンティティ統計
  getEntityStats(): any {
    const entities = this.getEntities()
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
  }
}
