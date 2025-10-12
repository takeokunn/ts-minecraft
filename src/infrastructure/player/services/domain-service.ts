import { PlayerDomainService, createPlayerDomainService } from '@domain/player/services'
import { Layer } from 'effect'

export const PlayerDomainServiceLayer = Layer.effect(PlayerDomainService, createPlayerDomainService)
