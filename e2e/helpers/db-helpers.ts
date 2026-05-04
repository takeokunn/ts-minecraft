import type { PlaywrightTestArgs } from '@playwright/test'

type Page = PlaywrightTestArgs['page']

const DB_NAME = 'minecraft-worlds'
const STORE_CHUNKS = 'chunks'
const STORE_METADATA = 'metadata'

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
