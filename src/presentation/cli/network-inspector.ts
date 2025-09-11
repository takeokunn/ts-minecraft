import { Effect, Ref } from 'effect'

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

export const createNetworkInspector = () =>
  Effect.gen(function* () {
    const isOpenRef = yield* Ref.make(false)
    const inspectorElementRef = yield* Ref.make<HTMLElement | null>(null)
    const requestsRef = yield* Ref.make<NetworkRequest[]>([])
    const isRecordingRef = yield* Ref.make(true)
    const maxRequestsRef = yield* Ref.make(1000)

    // Store original methods
    const originalFetchRef = yield* Ref.make(window.fetch)
    const originalXHROpenRef = yield* Ref.make(XMLHttpRequest.prototype.open)
    const originalXHRSendRef = yield* Ref.make(XMLHttpRequest.prototype.send)

    const toggle = () =>
      Effect.gen(function* () {
        const isOpen = yield* Ref.get(isOpenRef)
        if (isOpen) {
          yield* close()
        } else {
          yield* open()
        }
      })

    const open = () =>
      Effect.gen(function* () {
        yield* Ref.set(isOpenRef, true)
        const element = yield* Ref.get(inspectorElementRef)
        if (element) {
          element.style.display = 'block'
          yield* refreshRequestList()
        }
        yield* Effect.log('🌐 Network Inspector opened')
      })

    const close = () =>
      Effect.gen(function* () {
        yield* Ref.set(isOpenRef, false)
        const element = yield* Ref.get(inspectorElementRef)
        if (element) {
          element.style.display = 'none'
        }
        yield* Effect.log('🌐 Network Inspector closed')
      })

    const createInspectorUI = () =>
      Effect.gen(function* () {
        const inspectorElement = document.createElement('div')
        inspectorElement.id = 'network-inspector'
        inspectorElement.style.cssText = `
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

        yield* createHeader(inspectorElement)
        yield* createContent(inspectorElement)

        document.body.appendChild(inspectorElement)
        yield* Ref.set(inspectorElementRef, inspectorElement)
        yield* setupEventListeners()
      })

    const createHeader = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
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

        const isRecording = yield* Ref.get(isRecordingRef)
        const recordToggle = document.createElement('button')
        recordToggle.textContent = isRecording ? '⏸️' : '▶️'
        recordToggle.title = 'Toggle Recording'
        recordToggle.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        recordToggle.onclick = () => Effect.runSync(toggleRecording(recordToggle))

        const clearButton = document.createElement('button')
        clearButton.textContent = '🧹'
        clearButton.title = 'Clear'
        clearButton.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        clearButton.onclick = () => Effect.runSync(clearRequests())

        const exportButton = document.createElement('button')
        exportButton.textContent = '💾'
        exportButton.title = 'Export'
        exportButton.style.cssText = 'background: #555; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        exportButton.onclick = () => Effect.runSync(exportRequests())

        const closeButton = document.createElement('button')
        closeButton.textContent = '✕'
        closeButton.style.cssText = 'background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer;'
        closeButton.onclick = () => Effect.runSync(close())

        controls.appendChild(recordToggle)
        controls.appendChild(clearButton)
        controls.appendChild(exportButton)
        controls.appendChild(closeButton)

        header.appendChild(title)
        header.appendChild(controls)

        parentElement.appendChild(header)
      })

    const createContent = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
        const content = document.createElement('div')
        content.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-height: 0;'

        // Filter bar
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

        // Request list
        const requestList = document.createElement('div')
        requestList.id = 'request-list'
        requestList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: #111;
    `

        content.appendChild(filterBar)
        content.appendChild(requestList)

        parentElement.appendChild(content)
      })

    const setupEventListeners = () =>
      Effect.gen(function* () {
        // Filter event setup is omitted for brevity
        // In actual implementation, would set up event listeners on filter elements
      })

    const setupNetworkInterception = () =>
      Effect.gen(function* () {
        const originalFetch = yield* Ref.get(originalFetchRef)
        const originalXHROpen = yield* Ref.get(originalXHROpenRef)
        const originalXHRSend = yield* Ref.get(originalXHRSendRef)

        // Intercept Fetch
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const startTime = performance.now()
          const url = typeof input === 'string' ? input : input.toString()
          const method = init?.method || 'GET'

          const requestId = generateRequestId()

          // Record request information
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
            const response = await originalFetch(input, init)
            const endTime = performance.now()

            // Add response information
            const completeRequest: NetworkRequest = {
              ...(request as NetworkRequest),
              status: response.status,
              duration: endTime - startTime,
              requestSize: estimateSize(init?.body),
              responseSize: estimateSize(response),
            }

            Effect.runSync(addRequest(completeRequest))
            return response
          } catch (error) {
            const endTime = performance.now()

            const completeRequest: NetworkRequest = {
              ...(request as NetworkRequest),
              status: 0,
              duration: endTime - startTime,
              requestSize: estimateSize(init?.body),
              responseSize: 0,
            }

            Effect.runSync(addRequest(completeRequest))
            throw error
          }
        }

        // Intercept XMLHttpRequest
        XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
          ;(this as any)._networkInspector = {
            id: generateRequestId(),
            method,
            url: url.toString(),
            startTime: performance.now(),
            timestamp: Date.now(),
          }

          return originalXHROpen.call(this, method, url, ...args)
        }

        XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
          const requestInfo = (this as any)._networkInspector

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
                requestSize: estimateSize(body),
                responseSize: estimateSize(this.responseText),
                type: 'XHR',
                headers: {},
                payload: body,
                response: this.responseText,
              }

              Effect.runSync(addRequest(request))
            })
          }

          return originalXHRSend.call(this, body)
        }
      })

    const generateRequestId = (): string => {
      return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const estimateSize = (data: any): number => {
      if (!data) return 0
      if (typeof data === 'string') return new Blob([data]).size
      if (data instanceof ArrayBuffer) return data.byteLength
      if (data instanceof FormData) {
        // FormData size cannot be calculated precisely, so use an estimate
        return 1024 // 1KB as estimate
      }
      return JSON.stringify(data).length
    }

    const addRequest = (request: NetworkRequest) =>
      Effect.gen(function* () {
        const isRecording = yield* Ref.get(isRecordingRef)
        if (!isRecording) return

        const requests = yield* Ref.get(requestsRef)
        const newRequests = [request, ...requests] // Add new request to the beginning

        // Limit number of requests
        const maxRequests = yield* Ref.get(maxRequestsRef)
        const limitedRequests = newRequests.length > maxRequests ? newRequests.slice(0, maxRequests) : newRequests

        yield* Ref.set(requestsRef, limitedRequests)

        const isOpen = yield* Ref.get(isOpenRef)
        if (isOpen) {
          yield* refreshRequestList()
        }
      })

    const refreshRequestList = () =>
      Effect.gen(function* () {
        const inspectorElement = yield* Ref.get(inspectorElementRef)
        const requestList = inspectorElement?.querySelector('#request-list')
        if (!requestList) return

        requestList.innerHTML = ''

        const requests = yield* Ref.get(requestsRef)
        requests.forEach((request) => {
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

          const statusColor = getStatusColor(request.status)
          const url = request.url.length > 40 ? '...' + request.url.slice(-40) : request.url

          requestElement.innerHTML = `
        <div style="flex: 1;">
          <span style="color: ${statusColor}; font-weight: bold;">${request.method}</span>
          <span style="margin-left: 8px;">${url}</span>
        </div>
        <div style="display: flex; gap: 10px; font-size: 9px;">
          <span style="color: ${statusColor};">${request.status}</span>
          <span>${request.duration.toFixed(0)}ms</span>
          <span>${formatSize(request.responseSize)}</span>
        </div>
      `

          requestElement.onclick = () => Effect.runSync(showRequestDetails(request))
          requestList.appendChild(requestElement)
        })
      })

    const getStatusColor = (status: number): string => {
      if (status >= 200 && status < 300) return '#0f0'
      if (status >= 300 && status < 400) return '#ff0'
      if (status >= 400 && status < 500) return '#f80'
      if (status >= 500) return '#f00'
      return '#888'
    }

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes}B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }

    const showRequestDetails = (request: NetworkRequest) =>
      Effect.gen(function* () {
        yield* Effect.log(`🌐 Request Details: ${request.method} ${request.url}`)
        yield* Effect.log(`Status: ${request.status}`)
        yield* Effect.log(`Duration: ${request.duration.toFixed(2)}ms`)
        yield* Effect.log(`Request Size: ${formatSize(request.requestSize)}`)
        yield* Effect.log(`Response Size: ${formatSize(request.responseSize)}`)
        yield* Effect.log(`Headers: ${JSON.stringify(request.headers)}`)
        if (request.payload) yield* Effect.log(`Payload: ${JSON.stringify(request.payload)}`)
        if (request.response) yield* Effect.log(`Response: ${JSON.stringify(request.response)}`)
      })

    const toggleRecording = (button: HTMLButtonElement) =>
      Effect.gen(function* () {
        const isRecording = yield* Ref.get(isRecordingRef)
        const newRecordingState = !isRecording
        yield* Ref.set(isRecordingRef, newRecordingState)
        button.textContent = newRecordingState ? '⏸️' : '▶️'
        yield* Effect.log(`🌐 Network recording ${newRecordingState ? 'started' : 'stopped'}`)
      })

    const clearRequests = () =>
      Effect.gen(function* () {
        yield* Ref.set(requestsRef, [])
        yield* refreshRequestList()
        yield* Effect.log('🧹 Network requests cleared')
      })

    const exportRequests = () =>
      Effect.gen(function* () {
        const requests = yield* Ref.get(requestsRef)
        const summary = yield* getNetworkSummary()

        const data = {
          timestamp: Date.now(),
          requests,
          summary,
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

        yield* Effect.log('💾 Network requests exported')
      })

    const getNetworkSummary = () =>
      Effect.gen(function* () {
        const requests = yield* Ref.get(requestsRef)

        const summary = {
          totalRequests: requests.length,
          successfulRequests: requests.filter((r) => r.status >= 200 && r.status < 300).length,
          failedRequests: requests.filter((r) => r.status >= 400).length,
          averageResponseTime: 0,
          totalDataTransferred: 0,
          requestsByMethod: {} as Record<string, number>,
          requestsByStatus: {} as Record<string, number>,
        }

        if (requests.length > 0) {
          summary.averageResponseTime = requests.reduce((sum, r) => sum + r.duration, 0) / requests.length
          summary.totalDataTransferred = requests.reduce((sum, r) => sum + r.responseSize, 0)

          requests.forEach((request) => {
            summary.requestsByMethod[request.method] = (summary.requestsByMethod[request.method] || 0) + 1
            const statusGroup = `${Math.floor(request.status / 100)}xx`
            summary.requestsByStatus[statusGroup] = (summary.requestsByStatus[statusGroup] || 0) + 1
          })
        }

        return summary
      })

    const restore = () =>
      Effect.gen(function* () {
        // Restore original methods
        const originalFetch = yield* Ref.get(originalFetchRef)
        const originalXHROpen = yield* Ref.get(originalXHROpenRef)
        const originalXHRSend = yield* Ref.get(originalXHRSendRef)

        window.fetch = originalFetch
        XMLHttpRequest.prototype.open = originalXHROpen
        XMLHttpRequest.prototype.send = originalXHRSend
      })

    // Initialize UI and network interception in development mode
    if (import.meta.env.DEV) {
      yield* createInspectorUI()
      yield* setupNetworkInterception()
    }

    return {
      toggle,
      open,
      close,
      getNetworkSummary,
      restore,
    }
  })

// Factory function for easier usage
export const createNetworkInspectorFactory = () => {
  return Effect.runSync(createNetworkInspector())
}
