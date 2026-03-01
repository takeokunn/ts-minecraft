import type { Page } from '@playwright/test'

/**
 * Check if the 'minecraft-worlds' IndexedDB database has been created.
 * The game creates this DB on first chunk save/load.
 */
export async function isMinecraftWorldsDbCreated(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('minecraft-worlds')
      req.onsuccess = () => {
        req.result.close()
        resolve(true)
      }
      req.onerror = () => resolve(false)
    })
  })
}

/**
 * Check how many object stores exist in the minecraft-worlds DB.
 * Returns 0 if the DB does not exist.
 */
export async function getDbStoreCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('minecraft-worlds')
      req.onsuccess = () => {
        const count = req.result.objectStoreNames.length
        req.result.close()
        resolve(count)
      }
      req.onerror = () => resolve(0)
    })
  })
}
