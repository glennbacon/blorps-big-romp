# World map design

Date: 2026-11-14. Status: approved.

## What this is and why

Blorp's Big Romp plays its thirty levels in one straight line: title, 1-1, 1-2, and so on to 6-5. There is no way to
see the journey or to go back to a level.

This adds a world map: a 3D voxel landscape of Blorp's world, seen from above at an angle, with a path running across
it from level to level. The player walks Blorp along the path and plays any level that has been opened. The model is
the overworld map of Super Mario World on the SNES: one world laid out as terrain, level markers joined by paths, the
character walking from marker to marker, and the path growing as levels are cleared.

What the owner asked for, in his words: "a voxel world map that the player character can be moved along path and play
any world level that has been unlocked", and then, correcting a first proposal that was a side-on strip: "a voxel Blorp
version map that is 3D not 2.5D and is somewhat like Super Mario World SNES world map."

Everything below that is not in those two sentences is a proposal, marked **(call)** where it is a decision a reader
might want to overturn.

## Goals

1. A map that is plainly three-dimensional: terrain with real height (hills, a mountain, a sunken hollow, a floating
   island), seen in perspective, with the path running north, south, east and west across it and up and down it.
2. Blorp walks the path from marker to marker under the player's control, in four directions.
3. Every opened level can be played from the map, as many times as the player likes.
4. Clearing a level for the first time opens the next one, and the player sees that happen on the map.
5. It looks like part of this game: the same voxel boxes, the same six world palettes, the same Blorp.
6. It works with a keyboard and on a phone, upright or sideways.
7. Progress on the map survives closing the page. A save made before this change still works.

## Not goals

- Branching routes, secret exits or bonus levels. The thirty levels stay one route.
- Separate zoomed-in maps per world. There is one map.
- Tapping or clicking a marker to walk there.
- Any change to the levels themselves, or to the title screen's look.
- Per-level records (best score, coins found).
- A camera the player can turn or zoom.

## What would make it a failure even if it works

- It copies Super Mario World's actual map, art or music. The mechanics are the model; the world, its layout, its
  landmarks and its tune must be Blorp's own.
- It reads as flat: a board with icons on it, or the side-on strip again.
- A player can get stuck on it, or lose progress they had before the update.
- Touch players cannot move in all four directions.

## Constraints from the existing game

- The game is one HTML file built by `build.sh` from the pieces in `src/`, with no image or sound files. The map must be
  built in code the same way: models from boxes (`voxGeo`), colours from `THEMES`, sound from the synthesiser.
- three.js r128 from the CDN, one renderer, one scene, one camera. The level lives in the `world` group and is thrown
  away and rebuilt on each load.
- Up, W, Z and Space are all "jump" during play, and the touch deck has only left and right arrows.
- `tools/game.js` loads the source into Node with three.js stubbed out so that checks can drive the real rules. The map's
  rules (the route, what is open, where Blorp may walk) must work under those stubs, which means keeping them apart
  from the drawing.
- The save is one JSON object in local storage, and every use of storage may fail quietly.
- `tools/check-levels.js` and `tools/check-save.js` must keep passing, the second after being updated for the new flow.

## Ways to build it

**A. A hand-built voxel diorama inside the existing scene (chosen).** The terrain is painted in code with a small map
builder in the spirit of the level builder (fill an area, raise a hill, dig a hollow), the route is written as a list
of moves between markers, and the existing box mesher turns it into one mesh. The map is built once, kept in memory,
and swapped with the level by showing one group and hiding the other. The camera, Blorp's model, the HUD, the effects
and the input code are shared. Cost: someone has to design the island by hand. Benefit: landmarks and the route sit
exactly where they should, and it is easy to tweak.

**B. Terrain from a noise generator, with the route laid over it.** Less hand work on the terrain's shape, but landmarks
and the route cannot be placed on purpose, six distinct regions are hard to get, and every tweak means fighting the
generator. The result tends to look like generic hills rather than a designed place.

**C. A separate page, canvas or scene for the map.** Keeps the map code apart, but doubles the renderer, Blorp, the HUD
and the input handling, and makes moving between map and level slower and more fragile.

A is chosen because the request is for a designed place in the manner of a classic overworld, and because the game
already has every piece A needs. The owner described the outcome and left the method open, so this is a call.

## The design

### The world

One island group in a blue sea, roughly 46 cells wide and 30 deep, each cell one voxel column. Six regions, one per
world, each built from that world's palette in `THEMES` and dressed with the props the levels already use, shrunk to
map scale:

| World | Where | What it looks like on the map |
| --- | --- | --- |
| 1 Gumdrop Meadow | south-west | low green hills, candy trees, gumdrops, flowers, a sandy shore, Blorp's hut by 1-1 |
| 2 Glowshroom Grotto | south, middle | a sunken hollow ringed by purple rock, glowing mushrooms and crystals, goo pools |
| 3 Castle Crumble | south-east | a grey rock in a lava moat, reached by a plank bridge, King Grump's castle at 3-5 |
| 4 Snowcone Summit | north-east | the tallest ground on the map, white tops, pines, snowmen; the path climbs it |
| 5 Doughnut Dunes | north, middle | sand, stepped pyramids, cacti, an oasis |
| 6 Comet Citadel | north-west | a dark island floating high over the sea, lit windows, reached by a staircase of light beams, King Grump's tower at 6-5 |

Seen from above, north at the top, the route runs roughly like this (it wiggles far more than the sketch shows):

```
        6 COMET CITADEL                              4 SNOWCONE SUMMIT
        (floating)                                         /\
      [6-5]..6-4..6-1 <== beam stairs ==   5 DOUGHNUT    4-5  4-4
                                           DUNES            \   |
                                 5-5 .. 5-3 .. 5-1 <------ 4-1..4-3
                                                            ^
                                                            | bridge
   1 GUMDROP MEADOW        2 GLOWSHROOM GROTTO              |
   1-1 .. 1-2               (sunken)             3 CASTLE CRUMBLE
           |          2-1 .. 2-2   2-4 .. 2-5 ==== 3-1 .. 3-3
   hut    1-3 .. 1-5 ..       \..2-3/        bridge    \..[3-5]
                                                     (lava moat)
                     ~ ~ ~ sea, camera side ~ ~ ~
```

Height is what makes it 3D, so the route must use it: it climbs the meadow's hills, steps down into the grotto and
back out, crosses bridges over lava and sea, zigzags up the mountain to a marker at the peak, comes down into the
dunes, and climbs the beam stairs to the floating island. Along the route the ground changes by at most one step from
one cell to the next, so Blorp can hop it.

The sea is a moving surface with a lighter shelf along the coasts. A few voxel clouds drift over the map, below the
camera and clear of the route.

### The view

A perspective camera looks down from the south at about 50 degrees, close enough that around 20 by 15 cells are in view
on a wide screen. It follows Blorp smoothly in both directions and stops at the edges of the map. The player does not
control it. Daylight, no fog nearer than the far shore.

### Markers and the path

Thirty markers, one per level, in level order along one route. Each marker is a small raised pad:

- **Locked:** dull grey, with no path leading to it.
- **Open, not yet cleared:** bright and gently pulsing.
- **Cleared:** gold, with a small teal flag.
- The two King Grump levels (3-5 and 6-5) are a castle and a tower rather than a pad, in the same three states.

The path is a line of pale stepping tiles from marker to marker, moving only north, south, east or west between cells.
A stretch of path is visible once the marker at its start has been cleared. **(call)** Locked markers further on are
shown, greyed, so the player can see where the journey leads; the path to them is what is hidden.

### Moving Blorp

Blorp stands on a marker, facing the camera, idling as he does on the title screen. Pressing a direction that matches
the way a visible path leaves the marker sends him along it, hopping from tile to tile, turning corners by himself,
until he reaches the next marker. Holding a direction keeps him going through markers when the path continues that
way. Holding run makes him go faster. Presses made while he is walking are ignored.

Pressing a direction with no path that way does nothing but a small bump sound. Pressing toward a path that is not yet
open does the same, and the banner reminds the player to clear the level first.

A banner on the page (not in the 3D view) names the marker Blorp stands on, for example "2-3 · Glowshroom Grotto",
says whether it is cleared, and shows how to start it. It changes when he arrives.

| | Keyboard | Touch |
| --- | --- | --- |
| Walk the path | Arrow keys or W A S D | Four-way pad |
| Walk faster | Shift or X | B |
| Play the level | Space, Enter, Z or K | A |
| Sound | M | Sound button |

**(call)** On touch, the two-arrow pad becomes a four-way pad while the map is showing and goes back to two arrows in a
level. The pause button is hidden on the map, where there is nothing to pause.

### How the game flows now

**(call)** The map becomes the home between levels, as in the model.

- **Title.** Unchanged to look at. "Start romping" and "New game" start from nothing and go to the map with Blorp on
  1-1. "Continue at 2-3" goes to the map with Blorp on 2-3.
- **Playing a level.** Choosing a marker shows the usual level card and then the level, exactly as now.
- **Clearing a level.** The clear screen's button becomes "Back to the map". If this was the first time, the next level
  opens: back on the map, the new stretch of path appears tile by tile with rising blips, and the next marker lights
  up. Blorp stays on the marker he cleared; the player walks him on.
- **Losing a life.** As now: the level restarts, from the checkpoint if it was reached.
- **Game over.** As now the score and coins reset, lives go back to 3 and Blorp is small, but the button becomes "Back to
  the map" and Blorp is on the marker of the level he fell in.
- **Pause.** Gains "Back to the map" beside "Restart this level". Leaving this way keeps Blorp's lives, coins, score and
  power-up, and counts for nothing else.
- **Beating King Grump in 6-5.** The win screen as now, but its button becomes "Back to the map". Nothing is wiped: all
  thirty levels stay open and the last marker shows as cleared. Starting over is "New game" on the title.
  **(call)** The title is only ever shown when the page loads, as now, so starting over means reloading the page; no
  new way back to the title is added.

### What is saved

The save gains one field: the furthest level opened. Its existing `level` field now means the marker Blorp stands on.
**(call)** The new field counts one past the last level once 6-5 is cleared, so the gold last marker survives a reload.

- Written when Blorp arrives at a marker, when a level starts, when a level is cleared, when a life is lost, and at
  game over.
- A save from before this change has no "furthest opened" field. It is read as: everything up to its `level` is open,
  and Blorp stands on that level's marker.
- A save whose fields are out of range is ignored, as now.
- Finishing the game no longer clears the save.
- If storage is blocked the map still works for the visit and forgets afterwards, as now.

### Sound

A short original tune for the map, calmer than the level tunes, in the same two-voice sequencer. Small sounds for a
hop, for a blocked direction, for each tile of path appearing, for a marker opening, and for choosing a level.

### Checks

- `tools/check-save.js` is updated: new game and Continue land on the map; clearing a level opens the next and saves it;
  an old-format save is read as described; game over and the win keep the progress.
- A new `tools/check-map.js` proves the map is sound without drawing it: there are exactly as many markers as levels;
  every stretch of path moves one cell at a time, stays on land, bridge or stair, and never changes height by more than
  one step; no two stretches leave a marker in the same direction; with N levels open, Blorp can walk to markers 1 to N
  and no further; and walking is driven through the real map code with the same stubs the other checks use.
- `tools/check-levels.js` is run unchanged to show the levels were not disturbed.
- The map is looked at in a real browser, wide and phone-shaped, before it is called done.

### Where the code goes

A new source piece for the map, loaded after the play rules and before the flow code, with the rules (grid, route,
what is open, walking) kept apart from the drawing so the checks can use them. `build.sh`, `tools/game.js` and the
README's layout table list it. The README's controls, "what's in the game", saved progress and checks sections are
updated.

## Left to the builder

- The exact shape of the island, the heights, where each marker sits and how the route wiggles, within the layout above.
- The look of the markers, bridge, beam stairs, castle and tower.
- The map tune and the small sounds.
- Walking speed, camera distance and angle, and the timing of the path appearing.
- The wording on the banner and buttons.
- File names and how the map code is split.
