export {}

declare global {
  type Page = import('@playwright/test').PlaywrightTestArgs['page']

  type ConsoleMessage = {
    readonly type: () => string
    readonly text: () => string
  }

  interface Window {
    __TS_MINECRAFT_QA__?: {
      openInventoryForQA: () => Promise<void>
      craftRecipeForQA: (id: string) => Promise<void>
      stageProgressionScenario: () => Promise<void>
      collectStagedResources: () => Promise<void>
      getInventorySnapshot: () => Promise<Array<{ slot: number; blockType: string; count: number } | null>>
      moveItemToHotbar: (blockType: string, hotbarIndex: number) => Promise<boolean>
      stageBuildSupportBlock: () => Promise<void>
      selectHotbarSlot: (index: number) => Promise<void>
      placeSelectedItemInFront: () => Promise<void>
      clearBlocksInFront: () => Promise<void>
      spawnLowHealthZombieInFront: () => Promise<void>
      aimAtStagedZombie: () => Promise<void>
      attackFirstZombie: () => Promise<boolean>
      getEntitySnapshot: () => Promise<Array<{ type: string }>>
      getRenderingSnapshot: () => {
        sceneChildren: number
        chunkMeshCount: number
        visibleChunkMeshCount: number
        camera: { x: number; y: number; z: number; near: number; far: number }
        chunks: Array<{
          chunkCoord: unknown
          type: string
          visible: boolean
          vertexCount: number
          indexCount: number
          hasUv: boolean
          hasTileIndex: boolean
          tileIndexCount: number
          materialType: string
          textureLoaded: boolean
        }>
      }
    }
  }
}
