# Modding API (v1)

The game loads user mods registered on `window.__TS_MINECRAFT_MODS__` before
boot. A mod is a plain object with a name, a version, and optional event
hooks. Mod code runs exception-isolated: a throwing hook logs a warning and
is skipped for that event — it can never crash the game loop.

## Registering a mod

Add a script tag (or userscript/extension) that runs **before** the game:

```html
<script>
  window.__TS_MINECRAFT_MODS__ = window.__TS_MINECRAFT_MODS__ ?? []
  window.__TS_MINECRAFT_MODS__.push({
    name: 'lucky-stone',
    version: '1.0.0',

    onInit(ctx) {
      ctx.log('lucky-stone loaded')
    },

    // Fired after a block is successfully mined.
    onBlockBreak(event, ctx) {
      if (event.blockType === 'STONE' && Math.random() < 0.01) {
        ctx.giveItem('DIAMOND', 1)
        ctx.log(`lucky drop at ${event.x},${event.y},${event.z}`)
      }
    },

    // Fired after a block is successfully placed.
    onBlockPlace(event, ctx) {},

    // Fired roughly once per second while a world is running.
    async onTick(ctx) {
      const pos = await ctx.getPlayerPosition()
      if (pos !== null && pos.y < 10) ctx.log('deep underground!')
    },
  })
</script>
```

## Hook reference

| Hook | Signature | Fires |
| --- | --- | --- |
| `onInit` | `(ctx) => void` | Once, when a world session starts |
| `onBlockBreak` | `(event, ctx) => void` | After a successful mine (`event`: `{x, y, z, blockType}`) |
| `onBlockPlace` | `(event, ctx) => void` | After a successful placement (same event shape) |
| `onTick` | `(ctx) => void` | ~1 Hz while a world runs |

## Context capabilities

The context is deliberately narrow — reads plus one additive write. Mods
never receive raw game services.

| Method | Returns | Notes |
| --- | --- | --- |
| `ctx.giveItem(itemType, count)` | `Promise<boolean>` | Adds to the player inventory; `false` on unknown item or full inventory |
| `ctx.getPlayerPosition()` | `Promise<{x,y,z} \| null>` | Player body-center position |
| `ctx.getBlockAt(x, y, z)` | `Promise<string \| null>` | Block type at world coordinates |
| `ctx.log(message)` | `void` | Prefixed console log |

## Guarantees and limits (v1)

- Invalid registrations (missing `name`, non-function hooks) are skipped
  with a console warning; valid mods still load.
- Hooks are synchronous fire-and-forget from the game's perspective; async
  work inside a hook is fine but nothing awaits it.
- Multiplayer: hooks fire on the local client only; `giveItem` affects the
  local player. Server-authoritative modding is out of scope for v1.
- No block/recipe/entity *registration* yet — v1 is an event + capability
  API. Content registration is the planned v2 surface.
