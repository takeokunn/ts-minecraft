import { Layer } from 'effect'
import { PlayerDomainService, createPlayerDomainService } from '@domain/player/services'

export const PlayerDomainServiceLayer = Layer.effect(PlayerDomainService, createPlayerDomainService)
