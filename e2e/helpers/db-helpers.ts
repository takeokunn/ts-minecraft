import type { PlaywrightTestArgs } from '@playwright/test'

type Page = PlaywrightTestArgs['page']

const DB_NAME = 'minecraft-worlds'
const STORE_CHUNKS = 'chunks'
const STORE_METADATA = 'metadata'
const SETTINGS_DB_NAME = 'minecraft-settings'
const SETTINGS_STORE = 'settings'
const SETTINGS_KEY = 'current'

export type MinecraftWorldsDbSnapshot = Readonly<{
  exists: boolean
  storeNames: readonly string[]
  chunkCount: number
  metadataCount: number
}>

type MinecraftWorldsDbSnapshotRequest = Readonly<{
  dbName: string
  storeChunks: string
  storeMetadata: string
}>

export type MinecraftSettingsSnapshot = Readonly<{
  adaptivePerformanceMode?: boolean
  renderDistance?: number
  mouseSensitivity?: number
  dayLengthSeconds?: number
  audioEnabled?: boolean
  masterVolume?: number
  sfxVolume?: number
  musicVolume?: number
  graphicsQuality?: string
}>

type MinecraftSettingsRequest = Readonly<{
  dbName: string
  storeName: string
  key: string
}>

const settingsRecordFromUnknown = (value: unknown): MinecraftSettingsSnapshot | null => {
  if (value === null || typeof value !== 'object') return null
  return value as MinecraftSettingsSnapshot
}

export async function getMinecraftWorldsDbSnapshot(page: Page): Promise<MinecraftWorldsDbSnapshot> {
  return page.evaluate(async ({ dbName, storeChunks, storeMetadata }: MinecraftWorldsDbSnapshotRequest) => {
    const databaseExists = async (): Promise<boolean> => {
      const databases = await indexedDB.databases?.()
      if (databases === undefined) return false
      return databases.some((database) => database.name === dbName)
    }

    const openExistingDatabase = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName)

        request.onupgradeneeded = () => {
          request.transaction?.abort()
          reject(new Error(`IndexedDB database did not exist before open: ${dbName}`))
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database: ${dbName}`))
        request.onblocked = () => reject(new Error(`IndexedDB database open blocked: ${dbName}`))
      })

    const countStore = (db: IDBDatabase, storeName: string): Promise<number> => {
      if (!db.objectStoreNames.contains(storeName)) return Promise.resolve(0)

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const request = transaction.objectStore(storeName).count()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error(`Failed to count IndexedDB store: ${storeName}`))
      })
    }

    const exists = await databaseExists()
    if (!exists) {
      return {
        exists: false,
        storeNames: [],
        chunkCount: 0,
        metadataCount: 0,
      }
    }

    const db = await openExistingDatabase()
    try {
      const storeNames = Array.from(db.objectStoreNames)
      const [chunkCount, metadataCount] = await Promise.all([
        countStore(db, storeChunks),
        countStore(db, storeMetadata),
      ])

      return {
        exists: true,
        storeNames,
        chunkCount,
        metadataCount,
      }
    } finally {
      db.close()
    }
  }, { dbName: DB_NAME, storeChunks: STORE_CHUNKS, storeMetadata: STORE_METADATA })
}

export async function getMinecraftSettings(page: Page): Promise<MinecraftSettingsSnapshot | null> {
  const settings = await page.evaluate(async ({ dbName, storeName, key }: MinecraftSettingsRequest) => {
    const databaseExists = async (): Promise<boolean> => {
      const databases = await indexedDB.databases?.()
      if (databases === undefined) return false
      return databases.some((database) => database.name === dbName)
    }

    const openExistingDatabase = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName)

        request.onupgradeneeded = () => {
          request.transaction?.abort()
          reject(new Error(`IndexedDB database did not exist before open: ${dbName}`))
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database: ${dbName}`))
        request.onblocked = () => reject(new Error(`IndexedDB database open blocked: ${dbName}`))
      })

    const readSetting = (db: IDBDatabase): Promise<unknown> => {
      if (!db.objectStoreNames.contains(storeName)) return Promise.resolve(null)

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const request = transaction.objectStore(storeName).get(key)

        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error ?? new Error(`Failed to read IndexedDB store: ${storeName}`))
      })
    }

    const exists = await databaseExists()
    if (!exists) return null

    const db = await openExistingDatabase()
    try {
      return await readSetting(db)
    } finally {
      db.close()
    }
  }, { dbName: SETTINGS_DB_NAME, storeName: SETTINGS_STORE, key: SETTINGS_KEY })

  return settingsRecordFromUnknown(settings)
}

/**
 * Check if the 'minecraft-worlds' IndexedDB database has been created.
 * The game creates this DB on first chunk save/load.
 */
export async function isMinecraftWorldsDbCreated(page: Page): Promise<boolean> {
  const snapshot = await getMinecraftWorldsDbSnapshot(page)
  return snapshot.exists
}

/**
 * Check how many object stores exist in the minecraft-worlds DB.
 * Returns 0 if the DB does not exist.
 */
export async function getDbStoreCount(page: Page): Promise<number> {
  const snapshot = await getMinecraftWorldsDbSnapshot(page)
  return snapshot.storeNames.length
}
