import { Layer } from 'effect'
import { clone } from '@application/shared/clone'
import { CloneService } from '@domain/world_generation/domain_service/world_generation_orchestrator/error_recovery'

export const CloneServiceLive = Layer.succeed(CloneService, {
  clone,
})
