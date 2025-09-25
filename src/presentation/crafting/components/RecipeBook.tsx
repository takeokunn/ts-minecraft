import React, { useState, useMemo, useCallback } from 'react'
import { pipe, ReadonlyArray } from 'effect'
import type { CraftingRecipe } from '../../../domain/crafting/RecipeTypes'
import type { CraftingGUIEvent, RecipeFilterConfig } from '../CraftingGUITypes'
import { RecipeDisplay } from './RecipeDisplay'

interface RecipeBookProps {
  recipes: ReadonlyArray<CraftingRecipe>
  selectedRecipe?: string
  filterConfig: RecipeFilterConfig
  onRecipeSelect?: (event: CraftingGUIEvent) => void
  onSearch?: (event: CraftingGUIEvent) => void
  onCategoryChange?: (event: CraftingGUIEvent) => void
  onQuickCraft?: (recipeId: string, quantity: number) => void
  className?: string
}

export const RecipeBook: React.FC<RecipeBookProps> = ({
  recipes,
  selectedRecipe,
  filterConfig,
  onRecipeSelect,
  onSearch,
  onCategoryChange,
  onQuickCraft,
  className = ''
}) => {
  const [displayMode, setDisplayMode] = useState(filterConfig.displayMode)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([])

  const toggleFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(recipeId)) {
        newFavorites.delete(recipeId)
      } else {
        newFavorites.add(recipeId)
      }
      return newFavorites
    })
  }, [])

  const handleRecipeSelect = useCallback((event: CraftingGUIEvent) => {
    if (event._tag === 'RecipeSelected') {
      // Track recently used
      setRecentlyUsed(prev => {
        const newRecent = [event.recipeId, ...prev.filter(id => id !== event.recipeId)]
        return newRecent.slice(0, 10) // Keep only last 10
      })
    }
    onRecipeSelect?.(event)
  }, [onRecipeSelect])

  const handleQuickCraft = useCallback((recipeId: string) => {
    if (onQuickCraft) {
      onQuickCraft(recipeId, 1)
      // Track as recently used
      setRecentlyUsed(prev => {
        const newRecent = [recipeId, ...prev.filter(id => id !== recipeId)]
        return newRecent.slice(0, 10)
      })
    }
  }, [onQuickCraft])

  const sortedRecipes = useMemo(() => {
    let filteredRecipes = [...recipes]

    // Filter favorites if enabled
    if (showFavorites) {
      filteredRecipes = filteredRecipes.filter(r => favorites.has(r.id))
    }

    // Sort by criteria
    if (filterConfig.sortBy === 'recently-used') {
      filteredRecipes.sort((a, b) => {
        const aIndex = recentlyUsed.indexOf(a.id)
        const bIndex = recentlyUsed.indexOf(b.id)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    } else if (filterConfig.sortBy === 'most-crafted') {
      // Would need stats tracking for this
      // For now, just use recipe ID
      filteredRecipes.sort((a, b) => a.id.localeCompare(b.id))
    }

    return filteredRecipes
  }, [recipes, favorites, recentlyUsed, showFavorites, filterConfig.sortBy])

  const recentRecipes = useMemo(() => {
    return recentlyUsed
      .map(id => recipes.find(r => r.id === id))
      .filter(Boolean)
      .slice(0, 5)
  }, [recentlyUsed, recipes])

  return (
    <div className={`recipe-book ${className}`}>
      <div className="recipe-book-header">
        <h3>Recipe Book</h3>
        <div className="recipe-book-controls">
          <button
            className={`display-mode-button ${displayMode === 'grid' ? 'active' : ''}`}
            onClick={() => setDisplayMode('grid')}
            title="Grid View"
          >
            ⊞
          </button>
          <button
            className={`display-mode-button ${displayMode === 'list' ? 'active' : ''}`}
            onClick={() => setDisplayMode('list')}
            title="List View"
          >
            ☰
          </button>
          <button
            className={`display-mode-button ${displayMode === 'compact' ? 'active' : ''}`}
            onClick={() => setDisplayMode('compact')}
            title="Compact View"
          >
            ⋮⋮
          </button>
          <button
            className={`favorites-button ${showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(!showFavorites)}
            title="Show Favorites"
          >
            ★
          </button>
        </div>
      </div>

      {recentRecipes.length > 0 && !showFavorites && (
        <div className="recent-recipes">
          <h4>Recently Used</h4>
          <div className="recent-list">
            {recentRecipes.map(recipe => recipe && (
              <div
                key={recipe.id}
                className="recent-item"
                onClick={() => handleRecipeSelect({
                  _tag: 'RecipeSelected',
                  recipeId: recipe.id
                })}
              >
                <div className="recent-icon">
                  {recipe.result.itemId.split(':').pop()?.charAt(0).toUpperCase()}
                </div>
                <span className="recent-name">
                  {recipe.result.itemId.split(':').pop()}
                </span>
                <button
                  className={`favorite-star ${favorites.has(recipe.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(recipe.id)
                  }}
                >
                  {favorites.has(recipe.id) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recipe-book-content">
        <RecipeDisplay
          recipes={sortedRecipes}
          selectedRecipe={selectedRecipe}
          filterConfig={{ ...filterConfig, displayMode }}
          displayMode={displayMode}
          onRecipeSelect={handleRecipeSelect}
          onSearch={onSearch}
          onCategoryChange={onCategoryChange}
        />
      </div>

      {selectedRecipe && (
        <div className="recipe-actions">
          <button
            className="quick-craft-button"
            onClick={() => handleQuickCraft(selectedRecipe)}
          >
            Quick Craft
          </button>
          <button
            className={`favorite-button ${favorites.has(selectedRecipe) ? 'active' : ''}`}
            onClick={() => toggleFavorite(selectedRecipe)}
          >
            {favorites.has(selectedRecipe) ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>
        </div>
      )}

      <style>{`
        .recipe-book {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          border: 2px solid #4a2511;
          border-radius: 8px;
          overflow: hidden;
        }

        .recipe-book-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid #4a2511;
        }

        .recipe-book-header h3 {
          margin: 0;
          color: #ffc107;
          font-size: 18px;
        }

        .recipe-book-controls {
          display: flex;
          gap: 4px;
        }

        .display-mode-button,
        .favorites-button {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .display-mode-button:hover,
        .favorites-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .display-mode-button.active,
        .favorites-button.active {
          background: #4caf50;
          border-color: #4caf50;
        }

        .recent-recipes {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid #4a2511;
        }

        .recent-recipes h4 {
          margin: 0 0 8px 0;
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
        }

        .recent-list {
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }

        .recent-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          background: rgba(139, 69, 19, 0.4);
          border: 1px solid #4a2511;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          min-width: 80px;
        }

        .recent-item:hover {
          background: rgba(139, 69, 19, 0.6);
          transform: scale(1.05);
        }

        .recent-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #8b7355 0%, #6b5a45 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: white;
          font-size: 16px;
          font-weight: bold;
        }

        .recent-name {
          color: white;
          font-size: 11px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70px;
        }

        .favorite-star {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          background: rgba(0, 0, 0, 0.5);
          border: none;
          border-radius: 50%;
          color: #ffc107;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .favorite-star:hover {
          transform: scale(1.2);
        }

        .favorite-star.active {
          color: #ffeb3b;
          text-shadow: 0 0 4px rgba(255, 235, 59, 0.8);
        }

        .recipe-book-content {
          flex: 1;
          overflow: hidden;
        }

        .recipe-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-top: 1px solid #4a2511;
        }

        .quick-craft-button,
        .favorite-button {
          flex: 1;
          padding: 8px 16px;
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid rgba(76, 175, 80, 0.4);
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-craft-button:hover {
          background: rgba(76, 175, 80, 0.4);
          transform: scale(1.02);
        }

        .favorite-button {
          background: rgba(255, 193, 7, 0.2);
          border-color: rgba(255, 193, 7, 0.4);
        }

        .favorite-button:hover {
          background: rgba(255, 193, 7, 0.4);
        }

        .favorite-button.active {
          background: rgba(255, 193, 7, 0.5);
          border-color: #ffc107;
        }

        /* Scrollbar styling */
        .recent-list::-webkit-scrollbar,
        .recipe-book-content ::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }

        .recent-list::-webkit-scrollbar-track,
        .recipe-book-content ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .recent-list::-webkit-scrollbar-thumb,
        .recipe-book-content ::-webkit-scrollbar-thumb {
          background: rgba(139, 69, 19, 0.6);
          border-radius: 3px;
        }

        .recent-list::-webkit-scrollbar-thumb:hover,
        .recipe-book-content ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 69, 19, 0.8);
        }
      `}</style>
    </div>
  )
}