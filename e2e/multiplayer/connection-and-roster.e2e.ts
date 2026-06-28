import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { expect, test } from '@playwright/test'

import { GamePage } from '../fixtures/game-page'
import { waitForStableRender } from '../helpers/wait-helpers'

const ROOT_URL = 'http://localhost:5180/'
const SERVER_URL = 'ws://127.0.0.1:25565'
const SERVER_READY_MESSAGE = `ts-minecraft multiplayer server listening on ${SERVER_URL}`
const SERVER_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../packages/network/scripts/multiplayer-server.ts',
)

async function startMultiplayerServer(): Promise<ChildProcess> {
  const child = spawn('npx', ['tsx', SERVER_SCRIPT], {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
    env: {
      ...process.env,
      CI: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let bufferedStdout = ''

  await new Promise<void>((resolveReady, rejectReady) => {
    const cleanup = () => {
      child.off('error', onError)
      child.off('exit', onExit)
      child.stdout!.off('data', onStdout)
      child.stderr!.off('data', onStderr)
    }

    const onStdout = (chunk: Buffer) => {
      bufferedStdout += chunk.toString('utf8')
      if (bufferedStdout.includes(SERVER_READY_MESSAGE)) {
        cleanup()
        resolveReady()
      }
    }

    const onStderr = (chunk: Buffer) => {
      process.stderr.write(chunk)
    }

    const onError = (error: Error) => {
      cleanup()
      rejectReady(error)
    }

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup()
      rejectReady(
        new Error(
          `multiplayer server exited before readiness with code ${code ?? 'null'} and signal ${
            signal ?? 'null'
          }`,
        ),
      )
    }

    child.stdout!.on('data', onStdout)
    child.stderr!.on('data', onStderr)
    child.once('error', onError)
    child.once('exit', onExit)
  })

  return child
}

async function stopMultiplayerServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  child.kill('SIGTERM')

  const exited = once(child, 'exit').catch(() => undefined)
  const timeout = new Promise<void>((resolveTimeout) => {
    setTimeout(resolveTimeout, 5_000)
  })

  await Promise.race([exited, timeout])

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await once(child, 'exit').catch(() => undefined)
  }
}

async function connectPlayer(page: GamePage, playerName: string): Promise<void> {
  await page.page.locator('#multiplayer-connection-panel').waitFor({ state: 'visible', timeout: 15_000 })
  await page.page.locator('#mp-server-url').fill(SERVER_URL)
  await page.page.locator('#mp-player-name').fill(playerName)
  await page.page.getByRole('button', { name: 'Connect to multiplayer server' }).click()
  await expect(page.page.locator('#multiplayer-connection-panel')).toContainText(
    `Connected to ${SERVER_URL}`,
    { timeout: 15_000 },
  )
}

async function sendChatMessage(page: GamePage, message: string): Promise<void> {
  await page.page.keyboard.press('KeyT')
  const chatPanel = page.page.locator('#multiplayer-chat-panel')
  await expect(chatPanel).toBeVisible({ timeout: 15_000 })
  await page.page.locator('#mp-chat-input').fill(message)
  await page.page.locator('.mp-chat-send').click()
  await expect(chatPanel).toHaveAttribute('aria-hidden', 'true', { timeout: 15_000 })
}

async function getRemotePlayers(page: GamePage) {
  return page.page.evaluate(async () => (await window.__TS_MINECRAFT_QA__?.getRemotePlayersForQA()) ?? [])
}

test.describe.serial('multiplayer e2e', () => {
  let serverProcess: ChildProcess | null = null

  test.beforeAll(async () => {
    serverProcess = await startMultiplayerServer()
  })

  test.afterAll(async () => {
    if (serverProcess !== null) {
      await stopMultiplayerServer(serverProcess)
    }
  })

  test('connects two browsers to the same server and shows both players', async ({ page, browser }) => {
    const primary = new GamePage(page)
    const secondaryContext = await browser.newContext({ baseURL: ROOT_URL })
    const secondary = new GamePage(await secondaryContext.newPage())

    try {
      await Promise.all([primary.goto(ROOT_URL), secondary.goto(ROOT_URL)])
      await Promise.all([primary.waitForReady(), secondary.waitForReady()])
      await Promise.all([waitForStableRender(page, 1_000), waitForStableRender(secondary.page, 1_000)])

      await Promise.all([connectPlayer(primary, 'Alex-1'), connectPlayer(secondary, 'Alex-2')])

      await Promise.all([
        primary.page.locator('#game-canvas').click({ position: { x: 320, y: 240 } }),
        secondary.page.locator('#game-canvas').click({ position: { x: 320, y: 240 } }),
      ])

      await Promise.all([primary.pressKey('Tab'), secondary.pressKey('Tab')])

      const primaryRoster = primary.page.locator('#multiplayer-player-list-panel')
      const secondaryRoster = secondary.page.locator('#multiplayer-player-list-panel')

      await Promise.all([
        expect(primaryRoster).toBeVisible({ timeout: 15_000 }),
        expect(secondaryRoster).toBeVisible({ timeout: 15_000 }),
      ])

      await Promise.all([
        expect(primaryRoster).toContainText('1 player', { timeout: 15_000 }),
        expect(secondaryRoster).toContainText('1 player', { timeout: 15_000 }),
        expect(primaryRoster).toContainText('Alex-2', { timeout: 15_000 }),
        expect(secondaryRoster).toContainText('Alex-1', { timeout: 15_000 }),
      ])
    } finally {
      await secondaryContext.close().catch(() => undefined)
    }
  })

  test('broadcasts chat messages to both connected players', async ({ page, browser }) => {
    const primary = new GamePage(page)
    const secondaryContext = await browser.newContext({ baseURL: ROOT_URL })
    const secondary = new GamePage(await secondaryContext.newPage())

    try {
      await Promise.all([primary.goto(ROOT_URL), secondary.goto(ROOT_URL)])
      await Promise.all([primary.waitForReady(), secondary.waitForReady()])
      await Promise.all([waitForStableRender(page, 1_000), waitForStableRender(secondary.page, 1_000)])

      await Promise.all([connectPlayer(primary, 'Alex-1'), connectPlayer(secondary, 'Alex-2')])

      const message = 'Hello from multiplayer e2e'
      await sendChatMessage(primary, message)

      const primaryMessages = primary.page.locator('#multiplayer-chat-panel .mp-chat-messages')
      const secondaryMessages = secondary.page.locator('#multiplayer-chat-panel .mp-chat-messages')

      await Promise.all([
        expect(primaryMessages).toContainText('Alex-1', { timeout: 15_000 }),
        expect(primaryMessages).toContainText(message, { timeout: 15_000 }),
        expect(secondaryMessages).toContainText('Alex-1', { timeout: 15_000 }),
        expect(secondaryMessages).toContainText(message, { timeout: 15_000 }),
      ])
    } finally {
      await secondaryContext.close().catch(() => undefined)
    }
  })

  test('syncs remote player positions after movement', async ({ page, browser }) => {
    const primary = new GamePage(page)
    const secondaryContext = await browser.newContext({ baseURL: ROOT_URL })
    const secondary = new GamePage(await secondaryContext.newPage())

    try {
      await Promise.all([primary.goto(ROOT_URL), secondary.goto(ROOT_URL)])
      await Promise.all([primary.waitForReady(), secondary.waitForReady()])
      await Promise.all([waitForStableRender(page, 1_000), waitForStableRender(secondary.page, 1_000)])

      await Promise.all([connectPlayer(primary, 'Alex-1'), connectPlayer(secondary, 'Alex-2')])

      const movedPosition = await primary.page.evaluate(async () =>
        window.__TS_MINECRAFT_QA__?.movePlayerForQA({ x: 4, y: 1, z: -2 }),
      )

      await expect
        .poll(async () => {
          const remotePlayers = await getRemotePlayers(secondary)
          return remotePlayers.find((player) => player.playerName === 'Alex-1')
        }, { timeout: 15_000 })
        .toMatchObject({
          playerName: 'Alex-1',
          playerId: expect.any(String),
          x: movedPosition?.x,
          z: movedPosition?.z,
          y: expect.any(Number),
        })
    } finally {
      await secondaryContext.close().catch(() => undefined)
    }
  })
})
