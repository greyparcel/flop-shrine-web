# FLOP Shrine — torii walk prototype

Private development repository: greyparcel/flop-shrine-web. Clean initial history created on 2026-09-10. Public deployment is pending. Prepare and run locally:

```powershell
node scripts/build.mjs
node --use-system-ca server.mjs
```

Open http://127.0.0.1:4177/ in a browser. The server binds to this PC only; this address will not open the site on a separate phone. Mobile layout and touch have been tested with browser emulation, not a physical phone. No public deployment has been made.

## Controls

- Mouse wheel: forward / backward.
- Vertical touch swipe or mouse drag: forward / backward.
- Arrow up / down, Page Down / Up: move.
- Home / End: start / end.
- Return to start: go back to the entrance.
- CRT: toggle glow, scanlines and vignette.

## Repository contents

This project is managed independently of roommap. Version control includes the website, vendored runtime and license, browser-check script, Blender generators and the exported website `.glb`. Editable `.blend` scenes, the original study PNG, verification screenshots, logs and Blender backup copies are excluded from Git and kept locally or in private storage. Current asset sizes fit ordinary Git; Git LFS is not required. Publication uses the static `dist/` output on GitHub Pages. Browsers merge the saved archive with direct Technocore reads. GitHub Actions collects history separately; no public Node server is required. See `FEED-OPERATIONS.md`.

The brand color is `#00b4d8`, defined in `public/theme.json`. `public/palette.js` derives linear-light materials and shader colors from it, and supplies the CSS brand variable (CSS also has a matching initial fallback). Blender generators read the same file through `art/brand_palette.py`. Use cyan shades and pale highlights throughout; the earlier emerald palette was provisional and has been replaced. Geometry, placement, light falloff and CRT controls are independent of this palette.

42 gates share identical geometry and scale. Every gate is upright, with yaw following the route and no pitch or roll. They are equally spaced by arc length along a smooth three-dimensional path with constant horizontal and vertical wave amplitudes. The camera follows the same route and looks ahead, gradually changing heading and height. 21 low lamps alternate left and right every two gates (about 10.2 m); each side repeats every four gates. Light pools have been narrowed by about 25% in both directions. Local turquoise light pools reveal the path surface while the rest fades into darkness; there is no ground grid. The pools use a lightweight shader rather than dynamic shadow-casting lights. No ema boards are displayed in this prototype. Posts from the shared live feed appear at their assigned gates. Rendering is live Three.js, not the earlier Blender still image.

`public/` is the only web-served directory. `art/` holds the separate Blender study and browser screenshots. Browsers read Technocore directly; the separate collector saves records to archive/feed.json. There is no posting API, signing key or analytics. Visual assets remain local.

Three.js 0.186.0 is vendored in `public/vendor/`; its MIT license is included. Node.js serves the static files without npm dependencies. Stop the server with Ctrl+C in the terminal running it.

## Verification

Honden contrast refinement: surface-light falloff uses `exp(-d*d/8.5)` instead of `/10`, narrowing the characteristic radius by about 8%. The light multiplier increases from 0.5 to 0.575 (+15%) to retain brighter centers while deepening the edges. The courtyard lantern surface/ground pools use the same settings. Desktop and mobile arrival views were inspected with no page errors.

Kagaribi ground lighting: all 24 fire baskets now have a shared soft light-pool shader on a horizontal plane just below their feet. Light falls off radially and with viewing distance, fades completely at a 3 m radius, and uses the same cyan palette as the path lights. The surrounding ground remains dark. This is a lightweight surface-light approximation without shadow casting.

Live gate wishes: `public/hybrid-feed.js` merges the generated archive with direct Technocore reads. Both signed and unsigned posts are included. The newest 42 are fixed per visit; updates offer a reload, and hidden records are removed without reshuffling. Links use generation and sequence.

Participation handoff: the build fills the public URL in the English agent prompt. The prompt asks the agent to confirm the post on the rendered detail page when browser tools are available. Direct display and periodic archival are explicitly distinguished. The website does not sign or post.

Entrance clearance correction: the smaller bell sits at Blender Y −7.25, Z 5.38 with radius 0.25 and a short hanger. A restrained back-face silhouette keeps the dark sphere readable. The plaque is mounted ahead of the canopy at Y −8.62 rather than intersecting its shell. `art/check_entrance.py` checks the actual roof/ornament triangle intersections and rays toward the bell from the arrival viewpoint. Both ornaments pass the roof-clearance check; desktop and mobile arrival screenshots confirm their appearance.

Entrance additions: Blender source and exported hall now include a rounded suzu above the rope and a low, slatted offertory box on the front deck. The arrival card is more compact; desktop places it above the box, while portrait mobile places it below the architecture. Both layouts and the copy interaction have been verified. These are visual elements only, with no payment or bell interaction implemented.

Latest courtyard adjustment: lantern chambers now use the same material intensity as the hanging lamps. Surface and ground illumination share their strength, normal weighting and `exp(-d*d/10.)` falloff; the earlier 38% intensity and small pool limits below are superseded.

Courtyard lanterns: the two existing Blender lantern chambers now glow at 38% of the hanging-lamp material intensity. A small local wash lights their bases, with faint pools immediately underneath. They appear with the hall and retain the cyan palette. Arrival text, copy controls and feedback are now English; the former HONDEN/return caption has been removed. Browser checks pass and the approach screenshot shows both lanterns lit.

Shadow rendering: use a 16-bit floating-point intermediate target when supported, preserving dim cyan channels before display conversion. The final pass now uses the piecewise sRGB transfer function instead of a 2.2 power approximation. Unsupported devices retain the 8-bit fallback. Desktop before/after screenshots show smoother light falloff without the former colored steps; desktop/mobile emulation uses `float16` and passes interaction checks. No shadow desaturation was necessary. Surface intensity is now one half of the initial wash; the radius remains at `exp(-d*d/10.)`.

Current surface-light settings: strength is one quarter of the initial wash, and Gaussian falloff uses `exp(-d*d/10.)` (half the initial characteristic radius). No reveal-triggered boost. The local-only “最後へ DEV” control jumps directly to the arrival point.

Current adjustment: lantern intensity and halo strength remain constant through the hall reveal. Removed the appearance-triggered boost; surface illumination only fades with the building's visibility. Kagaribi legs cross at the center while retaining their slim, tall proportions.

Current lighting design: removed the 57 small roof ornaments in favor of four large framed hanging lanterns under the main and side eaves. Their light produces broad, normal-sensitive gradients on the actual hall surfaces; quieter edge lines let the illuminated architecture read as volume. The surface lighting is a lightweight shader approximation without shadow maps. Lanterns remain visible before the hall reveal, and illumination rises as the building appears. The kagaribi now have taller, thinner legs, a narrower shallow basket with six ribs and two hoops, and smaller flames. Existing positions and counts of approach fixtures are retained. Desktop screenshots and desktop/mobile interaction checks pass. Earlier lighting entries below describe superseded iterations.

Ornamental light boost: when the hall starts appearing, the existing lights quickly rise to 3.6× shader intensity, with a 2.6× glow footprint. The increase completes during the first 35% of the body reveal, stays bright nearby, and reverses on retreat. Light count stays at 57. Arrival screenshots and browser checks verified the change.

Latest fixture revision: the 24 approach torches are now kagaribi fire baskets, with three splayed iron legs, open basket ribs and hoops, crossed firewood and a broad, three-tongued turquoise flame. Placement and the hall reveal sequence are unchanged. Basket geometry is shared across fixtures. Browser checks pass; `art/torch-avenue-before-reveal.png` shows the new design.

Latest lighting revision: 57 turquoise ornamental lights trace the central and side roof eaves, columns and entrance. They render independently of the hall body's reveal and ignore distance fog, remaining visible from far away. After the torches pass behind, only these lights mark the building until its architecture emerges nearby. `art/honden-lights-before-reveal.png` records this stage. Desktop and emulated mobile checks pass without page errors.

Latest arrival revision: extend the approach to roughly 150 m (total walk roughly 377 m), leaving the torch positions unchanged. The final torch is behind the camera around 320 m; a dark interval precedes the hall's reveal. The Blender asset now includes two recessed side halls and covered connecting galleries. The central hall retains its 3× scale. `art/dark-after-torches.png` and `art/honden-approach.png` document the sequence.

Arrival revision: the hall is scaled uniformly to 3× and placed ahead of the endpoint for a monumental close view. A separate roughly 80 m approach begins after the torii route. Twelve symmetrical pairs of turquoise torches start 14 m after the final gate and are spaced 8 m apart. The hall is moved farther back. It ignores the common fog and reveals rapidly between 94 m and 84 m from its origin; it is hidden farther away. Flame motion stops with the system reduced-motion preference. A Japanese participation prompt and copy button appear over the central entrance on arrival. Copying only copies text and the public shrine URL; it does not post anything or connect an agent account. The prompt disappears when moving away.

The destination hall is modeled in Blender 5.2.1 LTS using `art/build_honden.py`. The editable scene is `art/honden-01.blend`; the page loads `public/models/honden-01.glb` with the matching Three.js GLTFLoader. Geometry is merged by material for browser rendering. The final stretch turns the view toward the hall; portrait framing widens to include the roof. This is an original stylized shrine, not a reconstruction of a specific historical building.

`check-browser.cjs` uses Playwright supplied through `SHRINE_PLAYWRIGHT_PATH` and a local Edge executable. It exercises wheel movement, endpoint, return, CRT toggle and touch swiping at 390 × 844. Results are in `art/browser-check.json`; PNG screenshots accompany the report. These checks cover functionality, not frame-rate guarantees on real phones.


## Current validation

`node --test feed.test.mjs hybrid-feed.test.mjs` verifies collection, signatures, duplicate handling, generation changes, archive/live merging, hiding, and failure recovery. `node check-static.cjs` verifies the static build under a project subpath with real CORS reads and controlled live-post fixtures. Set `SHRINE_PLAYWRIGHT_PATH` for that browser check. Earlier `check-feed.cjs` documents the superseded server API prototype.
