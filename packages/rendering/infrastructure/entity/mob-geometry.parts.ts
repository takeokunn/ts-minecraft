type Dim3 = readonly [number, number, number]

export type ZombieParts = Readonly<{
  head: Dim3
  body: Dim3
  arm: Dim3
  leg: Dim3
}>

export type QuadrupedParts = Readonly<{
  head: Dim3
  body: Dim3
  leg: Dim3
}>

export type ChickenParts = Readonly<{
  head: Dim3
  body: Dim3
  wing: Dim3
  leg: Dim3
}>

export type BatParts = Readonly<{
  head: Dim3
  body: Dim3
  wing: Dim3
  foot: Dim3
}>

export type SquidParts = Readonly<{
  head: Dim3
  body: Dim3
  tentacle: Dim3
}>

export type ZombiePalette = Readonly<{ head: number; body: number; arm: number; leg: number }>
export type QuadrupedPalette = Readonly<{ head: number; body: number; leg: number }>
export type ChickenPalette = Readonly<{ head: number; body: number; wing: number; leg: number }>
export type BatPalette = Readonly<{ head: number; body: number; wing: number; foot: number }>
export type SquidPalette = Readonly<{ head: number; body: number; tentacle: number }>

export const ZOMBIE_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.25],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.75, 0.25],
}
export const ZOMBIE_PALETTE: ZombiePalette = { head: 0x5a8a3a, body: 0x3f5e7a, arm: 0x5a8a3a, leg: 0x5a8a3a }

export const COW_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.4],
  body: [0.625, 0.5, 1.0],
  leg: [0.25, 0.75, 0.25],
}
export const COW_PALETTE: QuadrupedPalette = { head: 0x4a3020, body: 0x4a3020, leg: 0xf0f0f0 }

export const PIG_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.5, 0.625],
  leg: [0.25, 0.375, 0.25],
}
export const PIG_PALETTE: QuadrupedPalette = { head: 0xf0a0a0, body: 0xf0a0a0, leg: 0xf0a0a0 }

export const SHEEP_PARTS: QuadrupedParts = {
  head: [0.375, 0.375, 0.5],
  body: [0.5, 0.5, 0.875],
  leg: [0.25, 0.75, 0.25],
}
export const SHEEP_PALETTE: QuadrupedPalette = { head: 0xf0d8b0, body: 0xf5f5f5, leg: 0xf0d8b0 }

export const CHICKEN_PARTS: ChickenParts = {
  head: [0.32, 0.32, 0.32],
  body: [0.45, 0.48, 0.5],
  wing: [0.08, 0.28, 0.28],
  leg: [0.08, 0.35, 0.08],
}
export const CHICKEN_PALETTE: ChickenPalette = { head: 0xf5f5f5, body: 0xf5f5f5, wing: 0xf5f5f5, leg: 0xe0a020 }

export const BAT_PARTS: BatParts = {
  head: [0.3, 0.25, 0.25],
  body: [0.45, 0.22, 0.3],
  wing: [0.55, 0.05, 0.28],
  foot: [0.06, 0.12, 0.06],
}
export const BAT_PALETTE: BatPalette = { head: 0x2b2420, body: 0x1f1a17, wing: 0x15110f, foot: 0x2b2420 }

export const BEE_PARTS: BatParts = {
  head: [0.28, 0.24, 0.24],
  body: [0.55, 0.32, 0.42],
  wing: [0.65, 0.04, 0.3],
  foot: [0.07, 0.1, 0.07],
}
export const BEE_PALETTE: BatPalette = { head: 0x1f1b13, body: 0xe4b83f, wing: 0xb9e6ff, foot: 0x1f1b13 }

export const SQUID_PARTS: SquidParts = {
  head: [0.5, 0.35, 0.5],
  body: [0.55, 0.5, 0.55],
  tentacle: [0.08, 0.55, 0.08],
}
export const SQUID_PALETTE: SquidPalette = { head: 0x315f8f, body: 0x2f78b7, tentacle: 0x1f4f7a }
export const GLOW_SQUID_PALETTE: SquidPalette = { head: 0x37d6c8, body: 0x5df0df, tentacle: 0x1db8aa }

export const WITCH_PARTS: ZombieParts = {
  head: [0.42, 0.55, 0.42],
  body: [0.56, 1.05, 0.32],
  arm: [0.18, 0.95, 0.18],
  leg: [0.18, 0.45, 0.18],
}
export const WITCH_PALETTE: ZombiePalette = { head: 0x6b8f4e, body: 0x4b2a63, arm: 0x3a214f, leg: 0x2a1a36 }

export const DROWNED_PARTS: ZombieParts = {
  head: [0.52, 0.5, 0.52],
  body: [0.52, 0.78, 0.28],
  arm: [0.2, 0.8, 0.2],
  leg: [0.22, 0.72, 0.22],
}
export const DROWNED_PALETTE: ZombiePalette = { head: 0x4fa89a, body: 0x1f5f72, arm: 0x3b8f80, leg: 0x1b4d5f }

export const ZOMBIE_VILLAGER_PARTS: ZombieParts = {
  head: [0.62, 0.58, 0.62],
  body: [0.58, 0.9, 0.32],
  arm: [0.22, 0.85, 0.22],
  leg: [0.22, 0.6, 0.22],
}
export const ZOMBIE_VILLAGER_PALETTE: ZombiePalette = { head: 0x7fa85a, body: 0x7a4f2a, arm: 0x6f9b4c, leg: 0x2f3f5f }

export const CREEPER_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.375],
  leg: [0.25, 0.5, 0.25],
}
export const CREEPER_PALETTE: QuadrupedPalette = { head: 0x2d5c1e, body: 0x2d5c1e, leg: 0x2d5c1e }

export const SKELETON_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.125],
  arm: [0.125, 0.75, 0.125],
  leg: [0.25, 0.75, 0.25],
}
export const SKELETON_PALETTE: ZombiePalette = { head: 0xf0f0f0, body: 0xf0f0f0, arm: 0xf0f0f0, leg: 0xf0f0f0 }

export const SPIDER_PARTS: QuadrupedParts = {
  head: [0.5, 0.375, 0.5],
  body: [1.5, 0.375, 0.75],
  leg: [0.125, 0.5, 0.125],
}
export const SPIDER_PALETTE: QuadrupedPalette = { head: 0x2a2a2a, body: 0x2a2a2a, leg: 0x2a2a2a }

export const ENDERMITE_PARTS: QuadrupedParts = {
  head: [0.24, 0.18, 0.24],
  body: [0.48, 0.18, 0.64],
  leg: [0.06, 0.18, 0.06],
}
export const ENDERMITE_PALETTE: QuadrupedPalette = { head: 0xb7b3a5, body: 0x8c887c, leg: 0x5f5b54 }

export const ENDERMAN_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.375, 0.875, 0.25],
  arm: [0.125, 1.5, 0.125],
  leg: [0.125, 3.0, 0.125],
}
export const ENDERMAN_PALETTE: ZombiePalette = { head: 0x1a0d2e, body: 0x111111, arm: 0x111111, leg: 0x111111 }

export const DRAGON_PARTS: ZombieParts = {
  head: [1.0, 0.75, 1.5],
  body: [1.25, 1.0, 3.0],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.5, 0.25],
}
export const DRAGON_PALETTE: ZombiePalette = { head: 0x0a0020, body: 0x0a0020, arm: 0x0a0020, leg: 0x0a0020 }

