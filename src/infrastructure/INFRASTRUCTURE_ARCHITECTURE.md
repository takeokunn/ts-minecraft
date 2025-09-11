# Infrastructure Architecture - TypeScript Minecraft Project

## Overview

The Infrastructure layer has been organized following the **Adapter Pattern** and **Repository Pattern** to implement Domain-Driven Design (DDD) principles. This layer provides concrete implementations of domain ports while maintaining clean separation between business logic and technical concerns.

## Architecture Principles

- **Dependency Inversion**: Infrastructure implements domain ports, not the other way around
- **Clean Architecture**: Technical details are isolated from domain logic
- **Adapter Pattern**: External systems are wrapped in adapters that implement domain interfaces
- **Repository Pattern**: Data persistence is abstracted through repositories
- **Effect-TS Integration**: All implementations use Effect-TS for functional programming and dependency injection

## Directory Structure

```
src/infrastructure/
├── adapters/           # External system adapters implementing domain ports
│   ├── browser-input.adapter.ts    # Browser DOM input adapter
│   ├── clock.adapter.ts           # Browser performance timer adapter
│   ├── three-js.adapter.ts        # Three.js rendering adapter
│   ├── webgpu.adapter.ts          # WebGPU advanced rendering adapter
│   ├── websocket.adapter.ts       # WebSocket network adapter
│   └── index.ts                   # Adapter exports and compositions
├── repositories/       # Data persistence implementations
│   ├── chunk.repository.ts        # Chunk data persistence
│   ├── entity.repository.ts       # Entity data management
│   ├── world.repository.ts        # World state repository
│   └── index.ts                   # Repository exports and compositions
├── layers/            # Effect-TS layer definitions
│   ├── unified.layer.ts           # Unified service layer
│   └── *.live.ts                  # Individual service layers
├── workers/           # Web Worker implementations
├── gpu/              # GPU-specific implementations
├── network/          # Network infrastructure
├── storage/          # Storage systems
├── ui/               # UI infrastructure
└── performance/      # Performance monitoring
```

## Adapter Pattern Implementation

### Domain Port Interfaces

All adapters implement domain port interfaces located in `src/domain/ports/`:

- **IInputPort**: Input device abstraction
- **IClockPort**: Time and timing operations
- **IRenderPort**: Rendering operations
- **IRaycastPort**: 3D raycasting
- **IWorldRepository**: World data operations

### Adapter Implementations

#### 1. Browser Input Adapter (`browser-input.adapter.ts`)

- **Purpose**: Handles browser DOM events for keyboard and mouse input
- **Implements**: `IInputPort`
- **Features**:
  - Event queue processing
  - Pointer lock management
  - Real-time input state tracking
  - Effect-TS based event handling

#### 2. Clock Adapter (`clock.adapter.ts`)

- **Purpose**: Provides time operations using browser Performance API
- **Implements**: `IClockPort`
- **Features**:
  - Delta time calculation
  - FPS monitoring
  - Time scaling
  - Pause/resume functionality

#### 3. Three.js Adapter (`three-js.adapter.ts`)

- **Purpose**: 3D rendering using Three.js library
- **Implements**: `IRenderPort`
- **Features**:
  - Render command queuing
  - Chunk mesh management
  - Camera control
  - Lighting and materials

#### 4. WebGPU Adapter (`webgpu.adapter.ts`)

- **Purpose**: Advanced GPU rendering with WebGPU API
- **Implements**: `IRenderPort`
- **Features**:
  - Compute shader support
  - Advanced pipeline management
  - Resource optimization
  - Performance monitoring

#### 5. WebSocket Adapter (`websocket.adapter.ts`)

- **Purpose**: Real-time network communication
- **Features**:
  - Connection state management
  - Message queuing
  - Automatic reconnection
  - Heartbeat monitoring

### Adapter Layer Compositions

The `adapters/index.ts` provides pre-configured layer combinations:

```typescript
// Basic browser setup
export const BasicBrowserAdapters = Layer.mergeAll(ThreeJsRenderingLayer, BrowserInputLayer, BrowserClockLayer)

// Advanced setup with WebGPU and networking
export const AdvancedBrowserAdapters = Layer.mergeAll(ThreeJsRenderingLayer, WebGPULayer, BrowserInputLayer, BrowserClockLayer, WebSocketLayer)
```

## Repository Pattern Implementation

### Repository Interfaces

All repositories implement domain interfaces:

- **IWorldRepository**: ECS world state management
- **IEntityRepository**: Entity lifecycle and component operations
- **IChunkRepository**: Chunk data persistence and spatial queries

### Repository Implementations

#### 1. World Repository (`world.repository.ts`)

- **Purpose**: ECS (Entity-Component-System) world state management
- **Features**:
  - Component storage with schemas
  - Archetype-based entity organization
  - SoA (Structure of Arrays) queries
  - Optimistic locking with versioning

#### 2. Entity Repository (`entity.repository.ts`)

- **Purpose**: Specialized entity operations and queries
- **Features**:
  - Entity lifecycle management
  - Component CRUD operations
  - Bulk operations
  - Change tracking and metadata

#### 3. Chunk Repository (`chunk.repository.ts`)

- **Purpose**: World chunk data management
- **Features**:
  - Spatial indexing
  - Generation stage tracking
  - Block-level operations
  - Performance monitoring

### Repository Layer Compositions

The `repositories/index.ts` provides layer combinations:

```typescript
// All repositories
export const AllRepositories = Layer.mergeAll(WorldRepositoryLive, EntityRepositoryLive, ChunkRepositoryLive)

// Core gameplay repositories
export const CoreRepositories = Layer.mergeAll(WorldRepositoryLive, EntityRepositoryLive)
```

## Service Migration Status

✅ **Completed Migrations**:

- Input management → `BrowserInputAdapter`
- Clock/timing → `BrowserClockAdapter`
- Rendering → `ThreeJsAdapter` / `WebGPUAdapter`

✅ **Existing Implementations**:

- All services properly implement domain ports
- Effect-TS dependency injection throughout
- Unified layer system in place

## Key Benefits

### 1. **Clean Architecture Compliance**

- Domain layer depends only on abstractions (ports)
- Infrastructure provides concrete implementations
- Easy to swap implementations (Three.js ↔ WebGPU)

### 2. **Testability**

- Mock adapters can be easily created for testing
- Repositories can be swapped for in-memory versions
- Domain logic remains isolated and testable

### 3. **Extensibility**

- New rendering backends can be added by implementing `IRenderPort`
- Different input methods (gamepad, VR) can implement `IInputPort`
- Storage backends can be swapped by implementing repositories

### 4. **Performance**

- Adapter pattern allows for specialized optimizations
- Repository pattern enables efficient data access patterns
- Effect-TS provides optimal async/concurrent operations

## Usage Examples

### Basic Setup

```typescript
import { BasicBrowserAdapters, CoreRepositories } from '@infrastructure'

const AppLayer = Layer.mergeAll(BasicBrowserAdapters, CoreRepositories)
```

### Advanced Setup

```typescript
import { AdvancedBrowserAdapters, AllRepositories } from '@infrastructure'

const AdvancedAppLayer = Layer.mergeAll(AdvancedBrowserAdapters, AllRepositories, DomainServicesLive)
```

### Custom Configuration

```typescript
import { ThreeJsRenderingLayer, WebSocketLayer, WorldRepositories } from '@infrastructure'

const CustomLayer = Layer.mergeAll(ThreeJsRenderingLayer, WebSocketLayer, WorldRepositories)
```

## Next Steps

The infrastructure is now properly organized following DDD principles with:

- ✅ Adapter pattern implementation
- ✅ Repository pattern implementation
- ✅ Domain port compliance
- ✅ Effect-TS integration
- ✅ Layer compositions

The architecture is ready for further development and easily extensible for new requirements.
