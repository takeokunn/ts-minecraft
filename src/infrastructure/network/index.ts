/**
 * Network Infrastructure - WebSocket-based networking services
 * 
 * This module provides WebSocket-based network infrastructure services
 * for multiplayer communication and state synchronization.
 */

// WebSocket Layer (formerly NetworkService)
export { NetworkService } from './websocket.layer'
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
} from './websocket.layer'