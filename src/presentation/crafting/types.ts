export interface CraftingSlotView {
  readonly coordinate: { readonly x: number; readonly y: number }
  readonly itemId?: string
  readonly itemName?: string
  readonly quantity?: number
  readonly highlighted?: boolean
}

export interface CraftingGridView {
  readonly width: number
  readonly height: number
  readonly slots: ReadonlyArray<CraftingSlotView>
}

export interface CraftingResultView {
  readonly itemId: string
  readonly itemName?: string
  readonly quantity: number
  readonly description?: string
}

export interface CraftingPanelView {
  readonly grid: CraftingGridView
  readonly result?: CraftingResultView
  readonly recipeId?: string
  readonly canCraft: boolean
}
