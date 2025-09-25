import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Effect, pipe, Option, Match, Runtime, Layer, Exit, Cause } from 'effect'
import type {
  CraftingGUIState,
  CraftingGUIEvent,
  CraftingSession,
  CraftingResultDisplay,
  RecipeFilterConfig
} from '../CraftingGUITypes'
import type { CraftingGrid as CraftingGridType, CraftingRecipe, CraftingItemStack } from '../../../domain/crafting/RecipeTypes'
import { CraftingGUIService, CraftingGUIServiceLive } from '../CraftingGUIService'
import { CraftingGrid, CraftingGridStyles } from './CraftingGrid'
import { RecipeDisplay } from './RecipeDisplay'
import { RecipeBook } from './RecipeBook'
import { CraftingResult } from './CraftingResult'
import { CraftingEngineServiceLive } from '../../../domain/crafting/CraftingEngineService'
import { RecipeRegistryServiceLive } from '../../../domain/crafting/RecipeRegistryService'
import { InventoryServiceLive } from '../../../domain/inventory/InventoryServiceLive'
import { Brand } from 'effect'

interface CraftingTableGUIProps {
  playerId: string
  tableType?: CraftingSession['craftingTableType']
  onClose?: () => void
  className?: string
}

// Create runtime with all required services
const createCraftingRuntime = () => {
  const MainLayer = Layer.mergeAll(
    RecipeRegistryServiceLive,
    CraftingEngineServiceLive,
    InventoryServiceLive
  ).pipe(
    Layer.provide(CraftingGUIServiceLive)
  )

  return Runtime.make(MainLayer)
}

export const CraftingTableGUI: React.FC<CraftingTableGUIProps> = ({
  playerId,
  tableType = 'workbench',
  onClose,
  className = ''
}) => {
  const [state, setState] = useState<CraftingGUIState>({
    _tag: 'CraftingGUIState',
    sessionId: '',
    craftingGrid: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined]
    ],
    resultSlot: undefined,
    selectedRecipe: undefined,
    availableRecipes: [],
    isProcessing: false,
    isDragging: false,
    draggedItem: undefined,
    draggedFromSlot: undefined,
    hoveredSlot: undefined,
    searchQuery: '',
    selectedCategory: 'all',
    showRecipeBook: true,
    animations: {}
  })

  const [session, setSession] = useState<CraftingSession | null>(null)
  const [craftingResult, setCraftingResult] = useState<CraftingResultDisplay | null>(null)
  const [recipes, setRecipes] = useState<ReadonlyArray<CraftingRecipe>>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runtimeRef = useRef<Runtime.Runtime<CraftingGUIService> | null>(null)
  const serviceRef = useRef<CraftingGUIService | null>(null)
  const updateStreamRef = useRef<any>(null)

  // Initialize the service
  useEffect(() => {
    const initService = async () => {
      try {
        const runtime = await Effect.runPromise(createCraftingRuntime())
        runtimeRef.current = runtime

        const service = Runtime.runSync(runtime)(CraftingGUIService)
        serviceRef.current = service

        // Initialize session
        const sessionEffect = service.initializeSession(playerId, tableType)
        const sessionResult = await Effect.runPromise(Runtime.runPromise(runtime)(sessionEffect))
        setSession(sessionResult)

        // Get initial state
        const stateEffect = service.getState()
        const initialState = await Effect.runPromise(Runtime.runPromise(runtime)(stateEffect))
        setState(initialState)

        // Load recipes
        const recipesEffect = service.getAvailableRecipes()
        const availableRecipes = await Effect.runPromise(Runtime.runPromise(runtime)(recipesEffect))
        setRecipes(availableRecipes)

        // Subscribe to updates
        const updateStream = service.subscribeToUpdates()
        updateStreamRef.current = Effect.runFork(Runtime.runFork(runtime)(
          Effect.gen(function* () {
            const stream = yield* updateStream
            yield* Effect.forEach(stream, (newState) =>
              Effect.sync(() => setState(newState))
            )
          })
        ))

        setIsInitialized(true)
      } catch (err) {
        console.error('Failed to initialize crafting service:', err)
        setError('Failed to initialize crafting table')
      }
    }

    initService()

    return () => {
      // Cleanup
      if (updateStreamRef.current) {
        updateStreamRef.current.unsafeInterrupt()
      }
      if (serviceRef.current && runtimeRef.current) {
        const disposeEffect = serviceRef.current.dispose()
        Effect.runPromise(Runtime.runPromise(runtimeRef.current)(disposeEffect))
      }
    }
  }, [playerId, tableType])

  // Event handlers
  const handleEvent = useCallback(async (event: CraftingGUIEvent) => {
    if (!serviceRef.current || !runtimeRef.current) return

    try {
      setState(prev => ({ ...prev, isProcessing: true }))
      const effect = serviceRef.current.handleEvent(event)
      await Effect.runPromise(Runtime.runPromise(runtimeRef.current)(effect))

      // Update crafting result if grid changed
      if (event._tag === 'ItemDrop' || event._tag === 'SlotClicked' || event._tag === 'GridCleared') {
        updateCraftingResult()
      }
    } catch (err) {
      console.error('Error handling event:', err)
      setError(`Failed to handle ${event._tag}`)
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [])

  const updateCraftingResult = useCallback(async () => {
    if (!serviceRef.current || !runtimeRef.current) return

    try {
      const grid: CraftingGridType = {
        _tag: 'CraftingGrid',
        width: 3,
        height: 3,
        slots: state.craftingGrid
      }
      const effect = serviceRef.current.updateGrid(grid)
      const result = await Effect.runPromise(Runtime.runPromise(runtimeRef.current)(effect))
      setCraftingResult(result)
    } catch (err) {
      console.error('Error updating crafting result:', err)
    }
  }, [state.craftingGrid])

  const handleCraft = useCallback(async () => {
    if (!serviceRef.current || !runtimeRef.current || !craftingResult?.canCraft) return

    try {
      setState(prev => ({ ...prev, isProcessing: true }))

      // Trigger crafting animation
      setState(prev => ({
        ...prev,
        animations: { ...prev.animations, crafting: true }
      }))

      const effect = serviceRef.current.craftItem(
        craftingResult.recipe ? Brand.nominal(craftingResult.recipe.id) : undefined,
        1
      )
      const result = await Effect.runPromise(Runtime.runPromise(runtimeRef.current)(effect))

      // Show success animation
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          animations: { ...prev.animations, crafting: false }
        }))
      }, 500)

      // Update result display
      updateCraftingResult()
    } catch (err) {
      console.error('Error crafting item:', err)
      setError('Failed to craft item')
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [craftingResult])

  const handleClearGrid = useCallback(() => {
    const event: CraftingGUIEvent = { _tag: 'GridCleared' }
    handleEvent(event)
  }, [handleEvent])

  const handleToggleRecipeBook = useCallback(() => {
    const event: CraftingGUIEvent = { _tag: 'RecipeBookToggled' }
    handleEvent(event)
  }, [handleEvent])

  const handleQuickCraft = useCallback((recipeId: string, quantity: number) => {
    const event: CraftingGUIEvent = {
      _tag: 'CraftingRequested',
      recipeId,
      quantity
    }
    handleEvent(event)
  }, [handleEvent])

  if (!isInitialized) {
    return (
      <div className="crafting-table-loading">
        <div className="loading-spinner">Loading crafting table...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="crafting-table-error">
        <div className="error-message">{error}</div>
        <button onClick={() => setError(null)}>Retry</button>
      </div>
    )
  }

  return (
    <div className={`crafting-table-gui ${className} ${state.animations.crafting ? 'crafting-animation' : ''}`}>
      <CraftingGridStyles />
      <div className="crafting-header">
        <h2 className="crafting-title">
          {tableType === 'workbench' ? 'Crafting Table' :
           tableType === 'furnace' ? 'Furnace' :
           tableType === 'player-inventory' ? 'Crafting' :
           'Special Crafting'}
        </h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      <div className="crafting-body">
        <div className="crafting-main">
          <div className="crafting-grid-section">
            <h3>Crafting Grid</h3>
            <CraftingGrid
              grid={{
                _tag: 'CraftingGrid',
                width: 3,
                height: 3,
                slots: state.craftingGrid
              }}
              onSlotClick={handleEvent}
              onItemDrop={handleEvent}
              onItemDragStart={handleEvent}
              onItemDragEnd={handleEvent}
              isReadOnly={state.isProcessing}
            />
            <div className="grid-controls">
              <button
                className="clear-button"
                onClick={handleClearGrid}
                disabled={state.isProcessing}
              >
                Clear Grid
              </button>
            </div>
          </div>

          <div className="crafting-result-section">
            <CraftingResult
              result={craftingResult}
              onCraft={handleCraft}
              isProcessing={state.isProcessing}
              showAnimation={state.animations.crafting || false}
            />
          </div>
        </div>

        {state.showRecipeBook && (
          <div className="recipe-book-section">
            <RecipeBook
              recipes={recipes}
              selectedRecipe={state.selectedRecipe}
              onRecipeSelect={handleEvent}
              onSearch={handleEvent}
              onCategoryChange={handleEvent}
              onQuickCraft={handleQuickCraft}
              filterConfig={{
                _tag: 'RecipeFilterConfig',
                categories: [],
                searchQuery: state.searchQuery,
                showCraftableOnly: false,
                sortBy: 'name',
                displayMode: 'grid'
              }}
            />
          </div>
        )}
      </div>

      <div className="crafting-footer">
        <button
          className="toggle-recipes-button"
          onClick={handleToggleRecipeBook}
        >
          {state.showRecipeBook ? 'Hide' : 'Show'} Recipe Book
        </button>
        {session && (
          <div className="crafting-stats">
            <span>Items Crafted: {session.stats.itemsCrafted}</span>
            <span>Recipes Used: {session.stats.recipesUsed}</span>
          </div>
        )}
      </div>

      <style>{`
        .crafting-table-gui {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
          border: 3px solid #4a2511;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          color: white;
          font-family: 'Minecraft', monospace;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .crafting-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 2px solid #4a2511;
        }

        .crafting-title {
          margin: 0;
          font-size: 24px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        }

        .close-button {
          width: 32px;
          height: 32px;
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid rgba(255, 0, 0, 0.4);
          border-radius: 4px;
          color: white;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: rgba(255, 0, 0, 0.4);
          transform: scale(1.1);
        }

        .crafting-body {
          flex: 1;
          display: flex;
          gap: 24px;
          padding: 24px;
          overflow: auto;
        }

        .crafting-main {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }

        .crafting-grid-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .crafting-grid-section h3 {
          margin: 0;
          font-size: 18px;
          color: #ffc107;
        }

        .grid-controls {
          display: flex;
          justify-content: center;
          margin-top: 8px;
        }

        .clear-button {
          padding: 8px 16px;
          background: rgba(255, 87, 34, 0.2);
          border: 1px solid rgba(255, 87, 34, 0.4);
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-button:hover:not(:disabled) {
          background: rgba(255, 87, 34, 0.4);
          transform: scale(1.05);
        }

        .clear-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .crafting-result-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 200px;
        }

        .recipe-book-section {
          flex: 1;
          min-width: 350px;
          max-width: 500px;
        }

        .crafting-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 2px solid #4a2511;
        }

        .toggle-recipes-button {
          padding: 8px 16px;
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid rgba(76, 175, 80, 0.4);
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-recipes-button:hover {
          background: rgba(76, 175, 80, 0.4);
          transform: scale(1.05);
        }

        .crafting-stats {
          display: flex;
          gap: 24px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .crafting-table-loading,
        .crafting-table-error {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border: 2px solid #4a2511;
          border-radius: 8px;
          padding: 32px;
          color: white;
          text-align: center;
        }

        .loading-spinner {
          font-size: 18px;
          animation: pulse 1.5s infinite;
        }

        .error-message {
          color: #ff5252;
          margin-bottom: 16px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .crafting-animation {
          animation: craftingFlash 0.5s ease-in-out;
        }

        @keyframes craftingFlash {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .crafting-body {
            flex-direction: column;
          }

          .crafting-main {
            flex-direction: column;
            align-items: center;
          }

          .recipe-book-section {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}