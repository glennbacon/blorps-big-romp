# Blorp's Big Romp

A colorful voxel platformer with a 2.5D side-scrolling view, built with [three.js](https://threejs.org/). You play Blorp, a one-eyed teal monster, through three worlds of blocks to bonk, coins to grab and grumpy little monsters to squish. There is no time limit.

The whole game is one HTML file. There are no image or sound files: every model is built in code from boxes, every texture is drawn on a 16×16 canvas, and all music and sound effects are synthesized with the Web Audio API.

## Play

Open `index.html` in a current version of Chrome, Safari, Firefox or Edge. Nothing needs installing. An internet connection is needed because three.js and the font load from CDNs.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or A / D | Arrow pads |
| Jump (hold to go higher) | Space, Up, W or Z | A |
| Run, and spit fire in fire form | Shift or X | B |
| Pause | P or Esc | Pause button |
| Sound on/off | M | Sound button |

On a phone held upright the game sits above a handheld-style control deck. In landscape the controls float over the corners. Pressing between A and B presses both.

## What's in the game

**Worlds**

1. **Gumdrop Meadow**: open grassland that introduces blocks, stomping, shells, springs and cloud ledges.
2. **Glowshroom Grotto**: a cave with goo pits, moving ledges and a low roof.
3. **Castle Crumble**: lava, spinning ember chains and King Grump at the end.

**Blocks and pickups**

- Bricks smash once Blorp is big.
- Blinking eye-blocks hold coins and power-ups. A few blocks are hidden.
- Muffin makes Blorp big, chili gives fire spit, star jelly makes Blorp invincible for ten seconds, a heart is an extra life.
- 100 coins also give a life.

**Monsters**

- Grumblobs, hopping Boings and flying Battys can be stomped.
- Shellbys leave a shell that can be kicked into other monsters.
- Spikits and pipe Chompers cannot be stomped. Use fire, a shell or a star.
- King Grump takes three stomps.

**Also:** springshrooms, one-way ledges, moving platforms and a checkpoint in each world.

## Physics

Walking, running, skidding and jumping use the NES Super Mario Bros. speeds and gravities, converted from pixels per frame to tiles per second. Jump height depends on how long the button is held and on how fast Blorp is moving at takeoff. Two deliberate departures: the jump is slightly stronger (about 4.2 tiles standing, 5 running), and there is a little jump buffering and ledge forgiveness so touch controls feel fair.

The simulation runs at a fixed 120 steps per second, independent of frame rate.

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | The built, playable game |
| `src/head.html` | Page markup, styles, HUD, screens and touch deck |
| `src/a_art.js` | Voxel geometry builder, pixel textures and every model |
| `src/b_levels.js` | Tile types, the level builder and the three levels |
| `src/c_audio.js` | Sound effects and the step-sequencer music |
| `src/d_world.js` | Renderer, themes, terrain mesher, scenery, effects and camera |
| `src/e_play.js` | Player physics, blocks, power-ups, monsters and the boss |
| `src/f_flow.js` | Level loading, animation, screens, input and the main loop |
| `src/tail.html` | Closing markup |
| `build.sh` | Joins the pieces in `src/` into `index.html` |

## Build

```bash
./build.sh
```

This needs only bash. If Node.js is installed, the script also checks the game script for syntax errors.

## Editing levels

Levels are written with a small builder in `src/b_levels.js`. Coordinates are in tiles, with the walking surface at `y = 2`.

```js
B.ground(0, 44)               // ground from column 0 to 44
 .row(21, 5, 'B?BMB')         // a row of blocks starting at column 21, height 5
 .pipe(31, 2)                 // a pipe two tiles tall; pass true to add a Chomper
 .enemy('blob', 27)           // a monster standing on the ground at column 27
 .plat(31, 2, 3, 'x', 3, 1.3) // a moving ledge
 .spring(60)
 .checkpoint(93)
 .goal(194);
```

Characters for `row`:

| Char | Tile | Char | Tile |
| --- | --- | --- | --- |
| `B` | Brick | `m` | Brick holding many coins |
| `?` | Coin block | `s` | Brick holding a star |
| `M` | Power-up block | `I` | Hidden block with a life |
| `S` | Star block | `i` | Hidden block with a coin |
| `L` | Life block | `H` | Hard block |
| `=` | One-way ledge | `C` | Coin |
| `^` | Spikes | | |

Monster types are `blob`, `shellby`, `spikit`, `batty`, `boing` and `chomper`.

For poking at a running game, the browser console has a `__romp` object with helpers such as `__romp.load(2)` to jump to a world and `__romp.tp(x, y)` to move Blorp.

## Credits

- [three.js](https://github.com/mrdoob/three.js) r128, MIT license, loaded from cdnjs.
- [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), SIL Open Font License, loaded from Google Fonts.

The characters, levels, art and music are original to this project.

## License

[MIT](LICENSE)
