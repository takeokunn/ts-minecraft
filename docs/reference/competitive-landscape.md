---
title: Competitive Landscape — Open-Source Minecraft Clones
category: reference
last_verified: 2026-07-10
---

# Competitive Landscape: Open-Source Minecraft Clones

A survey of notable open-source Minecraft clones and voxel engines, compared
against this project's [vanilla-parity matrix](./vanilla-parity.md). Claims
about other projects come from their public repositories/READMEs as of the
date above; this survey is grounded but **not exhaustive** — it covers the
projects that surface prominently in searches for the category.

## Category: browser-native TypeScript/three.js survival clones

This is this project's direct category — playable in a browser tab, no
install, TypeScript, three.js rendering.

| Project | Survival loop | Crafting | Mobs & combat | Redstone | Dimensions | Multiplayer | Tests | Notes |
|---|---|---|---|---|---|---|---|---|
| **this project** | ✅ full (hunger/health/XP/sleep/death) | ✅ 112 recipes, 5 stations, brewing, enchanting (24) | ✅ 20 mobs, melee+bow, armor, status effects | ✅ 12 components incl. pistons w/ trains+arm, observer, hopper, comparator (both modes), dispenser | ✅ Nether + End w/ progression | ✅ co-op (seed sync, edit-log replay, entity host authority) | 9,287 unit + 64 e2e | this document's host |
| [vyse12138/minecraft-threejs](https://github.com/vyse12138/minecraft-threejs) | 🟡 build/break, collision, save/load | ❌ | ❌ | ❌ | ❌ | ❌ (listed as "working on") | none found | functional prototype; explicitly WIP on water/perf |
| [mc.js](https://github.com/ian13456/mc.js-1) (DMCA'd → mine.js) | 🟡 build/break, world saving | ❌ documented | ❌ documented | ❌ | ❌ | ✅ (accounts, GraphQL backend) | n/a | archived after DMCA; self-described WIP |
| [Voxelize](https://github.com/voxelize/voxelize) | engine, not a game | ❌ (bring your own) | ❌ (bring your own) | ❌ | ❌ | ✅ engine-level (Rust server) | n/a | successor to mc.js; full-stack voxel ENGINE — survival systems are the integrator's job |
| [BurnyCoder/minecraft-clone](https://github.com/BurnyCoder/minecraft-clone) | 🟡 basic voxel sandbox | ❌ | ❌ | ❌ | ❌ | ❌ | none found | author uses it as an LLM benchmark |

Within this category, no surveyed project documents a survival loop with
hunger/health/XP, any crafting system, any mob/combat system, any redstone,
or any additional dimension. This project's verified surface (see the parity
matrix — every ✅ grep-counted or live-tested) exceeds each surveyed
browser-native clone on every gameplay axis, and is the only one with a
substantial automated test suite (9,287 unit tests + 64 e2e).

## Adjacent categories (different trade-offs — not claimed as beaten)

| Project | Category | Where it exceeds this project |
|---|---|---|
| [Luanti (ex-Minetest)](https://www.luanti.org/) | native C++ engine + game ecosystem | modding (Lua API, thousands of mods), server scale, decade-plus content ecosystem |
| [Terasology](https://terasology.org/) | Java engine | module ecosystem, long-running project |
| [Craft (fogleman)](https://github.com/fogleman/Craft) | native C clone | minimal footprint, native performance |
| [Noa](https://github.com/fenomas/noa) | browser voxel engine (Babylon.js) | shipped Mojang's official Minecraft Classic browser release |
| [prismarine-web-client](https://github.com/PrismarineJS/prismarine-web-client) | web CLIENT for real MC servers | protocol compatibility with actual Minecraft servers |
| webmc | web client (protocol PoC) | real-server connectivity |

These are different value propositions: native engines trade browser reach
for modding/scale; protocol clients render the real game rather than
implementing one. This project does not claim superiority over them — the
honest differentiator is **the most feature-complete self-contained survival
implementation in the browser-native TypeScript category surveyed**, with
verification rigor (parity matrix provenance, real-input live testing,
measured performance floor) that none of the surveyed projects document.

## Known gaps relative to the wider field

Unchanged from the parity matrix: modding limited to data-driven recipe packs
(Luanti's scripting API remains its decisive advantage), boats/minecarts ride
only as movement modalities (no vehicle entities or models), co-op-scale
multiplayer only, audio not live-validatable on localhost by policy.

## Sources

- [vyse12138/minecraft-threejs](https://github.com/vyse12138/minecraft-threejs)
- [mc.js archive](https://github.com/ian13456/mc.js-1) and [Voxelize](https://github.com/voxelize/voxelize)
- [BurnyCoder/minecraft-clone](https://github.com/BurnyCoder/minecraft-clone)
- [GitHub voxel-game topic (TypeScript)](https://github.com/topics/voxel-game?l=typescript)
- Survey performed 2026-07-03 via web search + repository README review.
