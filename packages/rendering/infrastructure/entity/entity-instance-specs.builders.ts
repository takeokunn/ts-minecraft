import { Option } from 'effect'
import type { Dim3, PartRole, RoleSpec } from './entity-instance-specs.types'

// Factory helpers that build a per-(role) spec record for a body plan from its
// part dimensions + palette — the InstancedMesh analogue of the body-plan
// builders in mob-geometry.builders.shapes.ts. Called once per mob at module
// load in entity-instance-specs.ts; cost is paid once.

// Biped layout helper (head + body + 2 arms + 2 front legs; back legs absent).
export const buildBipedSpecs = (
  parts: { head: Dim3; body: Dim3; arm: Dim3; leg: Dim3; legXOff?: number },
  palette: { head: number; body: number; arm: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH] = parts.body
  const [, headH] = parts.head
  const [armW] = parts.arm
  const [legW, legH] = parts.leg
  const legXOff = parts.legXOff ?? legW / 2
  return {
    head: Option.some({ size: parts.head, pivot: 'center', offset: { x: 0, y: legH + bodyH + headH / 2, z: 0 }, color: palette.head, swingAxis: null }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: legH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.arm, pivot: 'top', offset: { x: +(bodyW / 2 + armW / 2), y: legH + bodyH, z: 0 }, color: palette.arm, swingAxis: 'x' }),
    armR: Option.some({ size: parts.arm, pivot: 'top', offset: { x: -(bodyW / 2 + armW / 2), y: legH + bodyH, z: 0 }, color: palette.arm, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.leg, pivot: 'top', offset: { x: +legXOff, y: legH, z: 0 }, color: palette.leg, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.leg, pivot: 'top', offset: { x: -legXOff, y: legH, z: 0 }, color: palette.leg, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

// Quadruped layout helper.
export const buildQuadrupedSpecs = (
  parts: { head: Dim3; body: Dim3; leg: Dim3 },
  palette: { head: number; body: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [legW, legH, legD] = parts.leg
  const xOff = bodyW / 2 - legW / 2
  const zOff = bodyD / 2 - legD / 2
  const hipY = legH

  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH - headH / 2 + 0.1, z: bodyD / 2 + headD / 2 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({
      size: parts.body,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH / 2, z: 0 },
      color: palette.body,
      swingAxis: null,
    }),
    armL: Option.none(),
    armR: Option.none(),
    legFL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legFR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
  }
}

export const buildChickenSpecs = (
  parts: { head: Dim3; body: Dim3; wing: Dim3; leg: Dim3 },
  palette: { head: number; body: number; wing: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [legW, legH] = parts.leg
  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH + headH / 2 - 0.03, z: bodyD / 2 + headD / 2 - 0.04 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: legH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.wing, pivot: 'top', offset: { x: +(bodyW / 2 + wingW / 2), y: legH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    armR: Option.some({ size: parts.wing, pivot: 'top', offset: { x: -(bodyW / 2 + wingW / 2), y: legH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.leg, pivot: 'top', offset: { x: +(legW * 1.1), y: legH, z: 0.05 }, color: palette.leg, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.leg, pivot: 'top', offset: { x: -(legW * 1.1), y: legH, z: 0.05 }, color: palette.leg, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

export const buildBatSpecs = (
  parts: { head: Dim3; body: Dim3; wing: Dim3; foot: Dim3 },
  palette: { head: number; body: number; wing: number; foot: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [footW, footH] = parts.foot
  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: footH + bodyH + headH / 2 - 0.02, z: bodyD / 2 + headD / 2 - 0.04 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: footH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.wing, pivot: 'top', offset: { x: +(bodyW / 2 + wingW / 2), y: footH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    armR: Option.some({ size: parts.wing, pivot: 'top', offset: { x: -(bodyW / 2 + wingW / 2), y: footH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.foot, pivot: 'top', offset: { x: +footW, y: footH, z: 0 }, color: palette.foot, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.foot, pivot: 'top', offset: { x: -footW, y: footH, z: 0 }, color: palette.foot, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

export const buildSquidSpecs = (
  parts: { head: Dim3; body: Dim3; tentacle: Dim3 },
  palette: { head: number; body: number; tentacle: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [headW, headH, headD] = parts.head
  const [, bodyH] = parts.body
  const [tentacleW, tentacleH, tentacleD] = parts.tentacle
  const xOff = headW / 2 - tentacleW / 2
  const zOff = headD / 2 - tentacleD / 2
  return {
    head: Option.some({ size: parts.head, pivot: 'center', offset: { x: 0, y: tentacleH + headH / 2, z: 0 }, color: palette.head, swingAxis: null }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: tentacleH + headH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.none(),
    armR: Option.none(),
    legFL: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: +xOff, y: tentacleH, z: +zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: -xOff, y: tentacleH, z: +zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legBL: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: +xOff, y: tentacleH, z: -zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legBR: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: -xOff, y: tentacleH, z: -zOff }, color: palette.tentacle, swingAxis: 'x' }),
  }
}
