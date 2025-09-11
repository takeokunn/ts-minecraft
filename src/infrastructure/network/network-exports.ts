/**
 * Network Infrastructure - Detailed Network Exports
 *
 * This module contains all detailed export statements for WebSocket-based networking services
 * for multiplayer communication and state synchronization.
 */

// WebSocket Layer (formerly NetworkService)
export { NetworkService } from '@infrastructure/network/websocket.layer'
export type {
  NetworkServiceInterface,
  ServerId,
  ConnectionId,
  PlayerId,
  RoomId,
  SubscriptionId,
  ServerConfig,
  ClientConfig,
  NetworkMessage,
  MessageType,
  MessagePriority,
  MessageHandler,
  PlayerCredentials,
  PlayerInfo,
  EntityState,
  WorldSyncData,
  ChunkSyncData,
  BlockUpdate,
  StateSyncRequest,
  StateSyncType,
  ConnectionStatus,
  RoomConfig,
  RoomInfo,
  RoomStatus,
  OptimizationResult,
  NetworkStats,
  ConnectionInfo,
  NetworkDebugInfo,
} from '@infrastructure/websocket.layer'
