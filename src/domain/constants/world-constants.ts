import { ColliderComponent } from './entities/components'
import { toFloat } from './value-objects/common'
import { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, WORLD_DEPTH, MIN_WORLD_Y, Y_OFFSET, RENDER_DISTANCE } from '@/shared/constants/world'

// Re-export physics constants for backward compatibility
export {
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  TERMINAL_VELOCITY,
  FRICTION,
  GRAVITY,
  DECELERATION,
  MIN_VELOCITY_THRESHOLD,
  PLAYER_HEIGHT,
  PLAYER_COLLIDER,
  BLOCK_COLLIDER,
} from '@/shared/constants/physics'

// Re-export world constants for backward compatibility
export { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, WORLD_DEPTH, MIN_WORLD_Y, Y_OFFSET, RENDER_DISTANCE } from '@/shared/constants/world'
