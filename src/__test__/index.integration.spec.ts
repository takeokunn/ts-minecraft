/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest'

describe('Index Integration', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''

    // Create app element that index.ts expects
    const app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)
  })

  it('should execute index.ts module', async () => {
    // This will actually execute the index.ts code
    await import(`../index.ts?v=${Date.now()}`) // force fresh import

    const app = document.querySelector('#app')
    expect(app?.innerHTML).toContain('TypeScript Minecraft Clone')
    expect(app?.innerHTML).toContain('Vite + TypeScript project initialized successfully!')
  })
})
