export interface VillagePlacementBlockReadErrorFields {
  readonly message: string
}

export class VillagePlacementBlockReadError extends Error {
  readonly _tag = 'VillagePlacementBlockReadError'

  constructor(readonly fields: VillagePlacementBlockReadErrorFields) {
    super(fields.message)
    this.name = 'VillagePlacementBlockReadError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
