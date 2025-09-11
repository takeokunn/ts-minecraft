export interface NetworkRequest {
  id: string
  url: string
  method: string
  status: number
  timestamp: number
  duration: number
  requestSize: number
  responseSize: number
  type: 'XHR' | 'Fetch' | 'WebSocket' | 'Worker'
  headers: Record<string, string>
  payload?: any
  response?: any
}

export class NetworkInspector {
  private isOpen: boolean = false
  private inspectorElement: HTMLElement | null = null
  private requests: NetworkRequest[] = []
  private isRecording: boolean = true
  private maxRequests: number = 1000

  // オリジナルのメソッドを保存
  private originalFetch: typeof fetch
  private originalXHROpen: any
  private originalXHRSend: any

  constructor() {
    this.originalFetch = window.fetch
    this.originalXHROpen = XMLHttpRequest.prototype.open
    this.originalXHRSend = XMLHttpRequest.prototype.send

    if (import.meta.env.DEV) {
      this.createInspectorUI()
      this.setupNetworkInterception()
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
      this.inspectorElement.style.display = 'block'
      this.refreshRequestList()
    }
    console.log('🌐 Network Inspector opened')
  }

  close(): void {
    this.isOpen = false
    if (this.inspectorElement) {
      this.inspectorElement.style.display = 'none'
    }
    console.log('🌐 Network Inspector closed')
  }

  private createInspectorUI(): void {
    this.inspectorElement = document.createElement('div')
    this.inspectorElement.id = 'network-inspector'
    this.inspectorElement.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 500px;
      height: 400px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #333;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      color: white;
      z-index: 10002;
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
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 6px 6px 0 0;
    `

    const title = document.createElement('span')
    title.textContent = '🌐 Network Inspector'
    title.style.fontWeight = 'bold'

    const controls = document.createElement('div')
    controls.style.cssText = 'display: flex; gap: 5px; align-items: center;'

    const recordToggle = document.createElement('button')
    recordToggle.textContent = this.isRecording ? '⏸️' : '▶️'
    recordToggle.title = 'Toggle Recording'
    recordToggle.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
    recordToggle.onclick = () => this.toggleRecording(recordToggle)

    const clearButton = document.createElement('button')
    clearButton.textContent = '🧹'
    clearButton.title = 'Clear'
    clearButton.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
    clearButton.onclick = () => this.clearRequests()

    const exportButton = document.createElement('button')
    exportButton.textContent = '💾'
    exportButton.title = 'Export'
    exportButton.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
    exportButton.onclick = () => this.exportRequests()

    const closeButton = document.createElement('button')
    closeButton.textContent = '✕'
    closeButton.style.cssText = 'background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
    closeButton.onclick = () => this.close()

    controls.appendChild(recordToggle)
    controls.appendChild(clearButton)
    controls.appendChild(exportButton)
    controls.appendChild(closeButton)

    header.appendChild(title)
    header.appendChild(controls)

    this.inspectorElement!.appendChild(header)
  }

  private createContent(): void {
    const content = document.createElement('div')
    content.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-height: 0;'

    // フィルターバー
    const filterBar = document.createElement('div')
    filterBar.style.cssText = 'padding: 5px; border-bottom: 1px solid #333; display: flex; gap: 10px; align-items: center;'

    const methodFilter = document.createElement('select')
    methodFilter.style.cssText = 'background: #222; color: white; border: 1px solid #444; padding: 2px;'
    methodFilter.innerHTML = `
      <option value="">All Methods</option>
      <option value="GET">GET</option>
      <option value="POST">POST</option>
      <option value="PUT">PUT</option>
      <option value="DELETE">DELETE</option>
    `

    const statusFilter = document.createElement('select')
    statusFilter.style.cssText = 'background: #222; color: white; border: 1px solid #444; padding: 2px;'
    statusFilter.innerHTML = `
      <option value="">All Status</option>
      <option value="2">2xx Success</option>
      <option value="3">3xx Redirect</option>
      <option value="4">4xx Client Error</option>
      <option value="5">5xx Server Error</option>
    `

    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'Filter URL...'
    searchInput.style.cssText = 'flex: 1; background: #222; color: white; border: 1px solid #444; padding: 2px 5px;'

    filterBar.appendChild(methodFilter)
    filterBar.appendChild(statusFilter)
    filterBar.appendChild(searchInput)

    // リクエストリスト
    const requestList = document.createElement('div')
    requestList.id = 'request-list'
    requestList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: #111;
    `

    content.appendChild(filterBar)
    content.appendChild(requestList)

    this.inspectorElement!.appendChild(content)
  }

  private setupEventListeners(): void {
    // フィルターイベントの設定は省略
    // 実際の実装では、フィルター要素にイベントリスナーを設定
  }

  private setupNetworkInterception(): void {
    // Fetchの傍受
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const startTime = performance.now()
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method || 'GET'

      const requestId = this.generateRequestId()

      // リクエスト情報を記録
      const request: Partial<NetworkRequest> = {
        id: requestId,
        url,
        method,
        timestamp: Date.now(),
        type: 'Fetch',
        headers: (init?.headers as Record<string, string>) || {},
        payload: init?.body,
      }

      try {
        const response = await this.originalFetch(input, init)
        const endTime = performance.now()

        // レスポンス情報を追加
        const completeRequest: NetworkRequest = {
          ...(request as NetworkRequest),
          status: response.status,
          duration: endTime - startTime,
          requestSize: this.estimateSize(init?.body),
          responseSize: this.estimateSize(response),
        }

        this.addRequest(completeRequest)
        return response
      } catch (error) {
        const endTime = performance.now()

        const completeRequest: NetworkRequest = {
          ...(request as NetworkRequest),
          status: 0,
          duration: endTime - startTime,
          requestSize: this.estimateSize(init?.body),
          responseSize: 0,
        }

        this.addRequest(completeRequest)
        throw error
      }
    }

    // XMLHttpRequestの傍受
    const self = this
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
      this._networkInspector = {
        id: self.generateRequestId(),
        method,
        url: url.toString(),
        startTime: performance.now(),
        timestamp: Date.now(),
      }

      return self.originalXHROpen.call(this, method, url, ...args)
    }

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const requestInfo = this._networkInspector

      if (requestInfo) {
        this.addEventListener('loadend', () => {
          const endTime = performance.now()

          const request: NetworkRequest = {
            id: requestInfo.id,
            url: requestInfo.url,
            method: requestInfo.method,
            status: this.status,
            timestamp: requestInfo.timestamp,
            duration: endTime - requestInfo.startTime,
            requestSize: self.estimateSize(body),
            responseSize: self.estimateSize(this.responseText),
            type: 'XHR',
            headers: {},
            payload: body,
            response: this.responseText,
          }

          self.addRequest(request)
        })
      }

      return self.originalXHRSend.call(this, body)
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private estimateSize(data: any): number {
    if (!data) return 0
    if (typeof data === 'string') return new Blob([data]).size
    if (data instanceof ArrayBuffer) return data.byteLength
    if (data instanceof FormData) {
      // FormDataのサイズは正確に計算できないため推定値
      return 1024 // 1KB as estimate
    }
    return JSON.stringify(data).length
  }

  private addRequest(request: NetworkRequest): void {
    if (!this.isRecording) return

    this.requests.unshift(request) // 新しいリクエストを先頭に追加

    // リクエスト数を制限
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(0, this.maxRequests)
    }

    if (this.isOpen) {
      this.refreshRequestList()
    }
  }

  private refreshRequestList(): void {
    const requestList = this.inspectorElement?.querySelector('#request-list')
    if (!requestList) return

    requestList.innerHTML = ''

    this.requests.forEach((request) => {
      const requestElement = document.createElement('div')
      requestElement.style.cssText = `
        padding: 5px 8px;
        border-bottom: 1px solid #222;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
      `

      requestElement.onmouseover = () => {
        requestElement.style.background = '#333'
      }
      requestElement.onmouseout = () => {
        requestElement.style.background = 'transparent'
      }

      const statusColor = this.getStatusColor(request.status)
      const url = request.url.length > 40 ? '...' + request.url.slice(-40) : request.url

      requestElement.innerHTML = `
        <div style="flex: 1;">
          <span style="color: ${statusColor}; font-weight: bold;">${request.method}</span>
          <span style="margin-left: 8px;">${url}</span>
        </div>
        <div style="display: flex; gap: 10px; font-size: 9px;">
          <span style="color: ${statusColor};">${request.status}</span>
          <span>${request.duration.toFixed(0)}ms</span>
          <span>${this.formatSize(request.responseSize)}</span>
        </div>
      `

      requestElement.onclick = () => this.showRequestDetails(request)
      requestList.appendChild(requestElement)
    })
  }

  private getStatusColor(status: number): string {
    if (status >= 200 && status < 300) return '#0f0'
    if (status >= 300 && status < 400) return '#ff0'
    if (status >= 400 && status < 500) return '#f80'
    if (status >= 500) return '#f00'
    return '#888'
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  private showRequestDetails(request: NetworkRequest): void {
    console.group(`🌐 Request Details: ${request.method} ${request.url}`)
    console.log('Status:', request.status)
    console.log('Duration:', `${request.duration.toFixed(2)}ms`)
    console.log('Request Size:', this.formatSize(request.requestSize))
    console.log('Response Size:', this.formatSize(request.responseSize))
    console.log('Headers:', request.headers)
    if (request.payload) console.log('Payload:', request.payload)
    if (request.response) console.log('Response:', request.response)
    console.groupEnd()
  }

  private toggleRecording(button: HTMLButtonElement): void {
    this.isRecording = !this.isRecording
    button.textContent = this.isRecording ? '⏸️' : '▶️'
    console.log(`🌐 Network recording ${this.isRecording ? 'started' : 'stopped'}`)
  }

  private clearRequests(): void {
    this.requests = []
    this.refreshRequestList()
    console.log('🧹 Network requests cleared')
  }

  private exportRequests(): void {
    const data = {
      timestamp: Date.now(),
      requests: this.requests,
      summary: this.getNetworkSummary(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `network-inspector-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log('💾 Network requests exported')
  }

  getNetworkSummary(): any {
    const summary = {
      totalRequests: this.requests.length,
      successfulRequests: this.requests.filter((r) => r.status >= 200 && r.status < 300).length,
      failedRequests: this.requests.filter((r) => r.status >= 400).length,
      averageResponseTime: 0,
      totalDataTransferred: 0,
      requestsByMethod: {} as Record<string, number>,
      requestsByStatus: {} as Record<string, number>,
    }

    if (this.requests.length > 0) {
      summary.averageResponseTime = this.requests.reduce((sum, r) => sum + r.duration, 0) / this.requests.length
      summary.totalDataTransferred = this.requests.reduce((sum, r) => sum + r.responseSize, 0)

      this.requests.forEach((request) => {
        summary.requestsByMethod[request.method] = (summary.requestsByMethod[request.method] || 0) + 1
        const statusGroup = `${Math.floor(request.status / 100)}xx`
        summary.requestsByStatus[statusGroup] = (summary.requestsByStatus[statusGroup] || 0) + 1
      })
    }

    return summary
  }

  // 復元機能
  restore(): void {
    // オリジナルのメソッドを復元
    window.fetch = this.originalFetch
    XMLHttpRequest.prototype.open = this.originalXHROpen
    XMLHttpRequest.prototype.send = this.originalXHRSend
  }
}
