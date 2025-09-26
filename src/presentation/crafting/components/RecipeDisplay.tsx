import React, { useState, useCallback, useMemo } from 'react'
import { Effect, Option, pipe, Array, Match } from 'effect'
import type {
  CraftingRecipe,
  ShapedRecipe,
  ShapelessRecipe,
  CraftingItemStack,
  ItemMatcher,
} from '../../../domain/crafting/RecipeTypes'
import { GridWidth, GridHeight } from '../../../domain/crafting/RecipeTypes'
import type { RecipeFilterConfig, RecipeDisplayMode, CraftingGUIEvent } from '../CraftingGUITypes'
import { CraftingGrid, CraftingGridStyles } from './CraftingGrid'

interface RecipeDisplayProps {
  recipes: readonly CraftingRecipe[]
  selectedRecipe?: string | undefined
  filterConfig?: RecipeFilterConfig
  displayMode?: RecipeDisplayMode
  onRecipeSelect?: (event: CraftingGUIEvent) => void
  onSearch?: (event: CraftingGUIEvent) => void
  onCategoryChange?: (event: CraftingGUIEvent) => void
  className?: string
}

interface RecipeCardProps {
  recipe: CraftingRecipe
  isSelected: boolean
  onClick: () => void
  displayMode: RecipeDisplayMode
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, isSelected, onClick, displayMode }) => {
  const [isHovered, setIsHovered] = useState(false)

  const renderRecipePattern = useCallback(() => {
    if (recipe._tag === 'shaped') {
      const shapedRecipe = recipe as ShapedRecipe
      const grid = {
        _tag: 'CraftingGrid' as const,
        width: GridWidth(shapedRecipe.pattern[0]?.length || 3),
        height: GridHeight(shapedRecipe.pattern.length),
        slots: shapedRecipe.pattern.map((row) =>
          row.map((key) => {
            if (!key) return null
            const matcher = shapedRecipe.ingredients[key]
            return matcher ? mockItemFromMatcher(matcher) : null
          })
        ),
      }
      return <CraftingGrid grid={grid} isReadOnly={true} className="recipe-preview-grid" />
    } else {
      const shapelessRecipe = recipe as ShapelessRecipe
      const items = shapelessRecipe.ingredients.map(mockItemFromMatcher)
      const grid = {
        _tag: 'CraftingGrid' as const,
        width: GridWidth(3),
        height: GridHeight(3),
        slots: distributeItemsInGrid(items, 3, 3),
      }
      return <CraftingGrid grid={grid} isReadOnly={true} className="recipe-preview-grid" />
    }
  }, [recipe])

  const mockItemFromMatcher = (matcher: ItemMatcher): CraftingItemStack => {
    return Match.value(matcher).pipe(
      Match.tag('exact', ({ itemId }) => ({
        _tag: 'CraftingItemStack' as const,
        itemId,
        count: 1 as any,
        metadata: {},
      })),
      Match.tag('tag', ({ tag }) => ({
        _tag: 'CraftingItemStack' as const,
        itemId: tag as any,
        count: 1 as any,
        metadata: {},
      })),
      Match.tag('custom', () => ({
        _tag: 'CraftingItemStack' as const,
        itemId: 'custom:item' as any,
        count: 1 as any,
        metadata: {},
      })),
      Match.exhaustive
    )
  }

  const distributeItemsInGrid = (items: CraftingItemStack[], width: number, height: number) => {
    const grid: (CraftingItemStack | null)[][] = globalThis
      .Array(height)
      .fill(null)
      .map(() => globalThis.Array(width).fill(null))
    let index = 0
    for (let y = 0; y < height && index < items.length; y++) {
      for (let x = 0; x < width && index < items.length; x++) {
        grid[y]![x] = items[index++]!
      }
    }
    return grid
  }

  if (displayMode === 'compact') {
    return (
      <div
        className={`recipe-card-compact ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="recipe-result-icon">
          <span>{recipe.result.itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
        </div>
        <span className="recipe-name">{recipe.result.itemId.split(':').pop()}</span>
      </div>
    )
  }

  if (displayMode === 'list') {
    return (
      <div
        className={`recipe-card-list ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="recipe-list-icon">
          <span>{recipe.result.itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
        </div>
        <div className="recipe-list-details">
          <h4>{recipe.result.itemId.split(':').pop()}</h4>
          <span className="recipe-category">{recipe.category._tag}</span>
        </div>
        <div className="recipe-list-result">
          <span className="result-count">×{recipe.result.count}</span>
        </div>
      </div>
    )
  }

  // Grid mode (default)
  return (
    <div
      className={`recipe-card ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="recipe-header">
        <h4>{recipe.result.itemId.split(':').pop()}</h4>
        <span className="recipe-type">{recipe._tag}</span>
      </div>
      <div className="recipe-content">
        <div className="recipe-pattern">{renderRecipePattern()}</div>
        <div className="recipe-arrow">→</div>
        <div className="recipe-result">
          <div className="result-item">
            <span className="result-icon">{recipe.result.itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
            <span className="result-count">×{recipe.result.count}</span>
          </div>
        </div>
      </div>
      <div className="recipe-footer">
        <span className="recipe-category">{recipe.category._tag}</span>
      </div>
    </div>
  )
}

export const RecipeDisplay: React.FC<RecipeDisplayProps> = ({
  recipes,
  selectedRecipe,
  filterConfig,
  displayMode = 'grid',
  onRecipeSelect,
  onSearch,
  onCategoryChange,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(filterConfig?.searchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState(filterConfig?.categories[0] || 'all')

  const categories = useMemo(() => {
    const cats = new Set<string>(['all'])
    recipes.forEach((recipe: CraftingRecipe) => cats.add(recipe.category._tag))
    return globalThis.Array.from(cats)
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    return pipe(
      recipes,
      Array.filter((recipe: CraftingRecipe) => {
        if (selectedCategory !== 'all' && recipe.category._tag !== selectedCategory) {
          return false
        }
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const name = recipe.result.itemId.toLowerCase()
          return name.includes(query)
        }
        return true
      })
    )
  }, [recipes, searchQuery, selectedCategory])

  const handleRecipeClick = useCallback(
    (recipeId: string) => {
      if (onRecipeSelect) {
        const event: CraftingGUIEvent = {
          _tag: 'RecipeSelected',
          recipeId,
        }
        onRecipeSelect(event)
      }
    },
    [onRecipeSelect]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      setSearchQuery(query)
      if (onSearch) {
        const event: CraftingGUIEvent = {
          _tag: 'RecipeSearch',
          query,
        }
        onSearch(event)
      }
    },
    [onSearch]
  )

  const handleCategoryChange = useCallback(
    (category: string) => {
      setSelectedCategory(category)
      if (onCategoryChange) {
        const event: CraftingGUIEvent = {
          _tag: 'CategorySelected',
          category,
        }
        onCategoryChange(event)
      }
    },
    [onCategoryChange]
  )

  return (
    <div className={`recipe-display ${className}`}>
      <CraftingGridStyles />
      <div className="recipe-controls">
        <div className="recipe-search">
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        <div className="recipe-categories">
          {categories.map((category) => (
            <button
              key={category}
              className={`category-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => handleCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <div className={`recipe-list recipe-list-${displayMode}`}>
        {filteredRecipes.map((recipe: CraftingRecipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            isSelected={selectedRecipe === recipe.id}
            onClick={() => handleRecipeClick(recipe.id)}
            displayMode={displayMode}
          />
        ))}
        {filteredRecipes.length === 0 && (
          <div className="no-recipes">
            <p>No recipes found</p>
          </div>
        )}
      </div>
      <style>{`
        .recipe-display {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
          border: 2px solid #4a2511;
        }

        .recipe-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recipe-search .search-input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: white;
          font-size: 14px;
        }

        .recipe-search .search-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .recipe-categories {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .category-button {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .category-button.active {
          background: #4caf50;
          border-color: #4caf50;
        }

        .recipe-list {
          display: grid;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }

        .recipe-list-grid {
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }

        .recipe-list-list {
          grid-template-columns: 1fr;
        }

        .recipe-list-compact {
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }

        .recipe-card {
          background: rgba(139, 69, 19, 0.6);
          border: 2px solid #4a2511;
          border-radius: 4px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .recipe-card.hovered {
          background: rgba(139, 69, 19, 0.8);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .recipe-card.selected {
          border-color: #ffc107;
          background: rgba(139, 69, 19, 0.9);
        }

        .recipe-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .recipe-header h4 {
          margin: 0;
          color: white;
          font-size: 16px;
        }

        .recipe-type {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }

        .recipe-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .recipe-pattern {
          flex: 1;
        }

        .recipe-pattern .recipe-preview-grid {
          transform: scale(0.6);
          transform-origin: left center;
        }

        .recipe-arrow {
          color: white;
          font-size: 24px;
          font-weight: bold;
        }

        .recipe-result {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
        }

        .result-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .result-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #8b7355 0%, #6b5a45 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }

        .result-count {
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .recipe-footer {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
        }

        .recipe-category {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }

        .recipe-card-list {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(139, 69, 19, 0.4);
          border: 1px solid #4a2511;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .recipe-card-list.hovered {
          background: rgba(139, 69, 19, 0.6);
        }

        .recipe-card-list.selected {
          border-color: #ffc107;
          background: rgba(139, 69, 19, 0.7);
        }

        .recipe-list-icon {
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

        .recipe-list-details {
          flex: 1;
        }

        .recipe-list-details h4 {
          margin: 0 0 4px 0;
          color: white;
          font-size: 14px;
        }

        .recipe-list-result {
          color: white;
          font-weight: bold;
        }

        .recipe-card-compact {
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
        }

        .recipe-card-compact.hovered {
          background: rgba(139, 69, 19, 0.6);
          transform: scale(1.05);
        }

        .recipe-card-compact.selected {
          border-color: #ffc107;
          background: rgba(139, 69, 19, 0.7);
        }

        .recipe-result-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #8b7355 0%, #6b5a45 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: white;
          font-size: 20px;
          font-weight: bold;
        }

        .recipe-name {
          color: white;
          font-size: 12px;
          text-align: center;
        }

        .no-recipes {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Scrollbar styles */
        .recipe-list::-webkit-scrollbar {
          width: 8px;
        }

        .recipe-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        .recipe-list::-webkit-scrollbar-thumb {
          background: rgba(139, 69, 19, 0.8);
          border-radius: 4px;
        }

        .recipe-list::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 69, 19, 1);
        }
      `}</style>
    </div>
  )
}
