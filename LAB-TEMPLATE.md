# Virtual Labs: the Atlas lab template

Internal note. It is not linked from the site, and `functions/LAB-TEMPLATE.md.js` makes Pages answer 404 for it.

The site is static: plain HTML and vanilla JS with no build step. Every lab page loads `site.js` (first thing in `<body>`), then `lab.css` and `site.css`, and `lab.js` at the end. The page calls `LAB.start('<key>')` (or `LAB.head('<key>')`). The shell is built from `lab.js`, so a lab page needs no shell markup of its own.

## Information architecture (lab.js `PATH`)

- `PATH` holds six areas in this order: `pof` Aerodynamics, `met` Meteorology and the atmosphere, `nav` Navigation and instrument procedures, `inst` Instruments, `sys` Aircraft and engine systems, `perf` Performance. After them comes one entry with `more:true` (`hf` Human factors). That entry is not an area. It shows up only in the quiet "More" list on `lab.html`.
- `UNLISTED` holds labs that are kept but not shown on `lab.html` (today: `massbalance.html`). They get the same shell (header, sidebar, step bar, goal, way back to Virtual Labs) but no area card and no count.
- `LAB.AREAS` lists the six areas. `LAB.MORE` lists the More entries. `LAB.FLAT` lists all 25 listed labs.
- Each area has `en`/`no`, a one-line description `d`, and 3–4 concepts `c` (all EN/NO). The area's labs are tuples `[file, key, EN, NO, level]`.
- `level` sets the "Applies to" tag: `''` all aircraft, `jet` A320 model, `mix` A320 + light twin, `la` light twin.
- The first lab in an area is its recommended start. On `lab.html` the "Open area" button links to that lab.
- `LAB.TOP[file]` lists a lab's sections as `[anchor id, EN, NO, type]`, with type `sim | drill | read | quiz`. The sidebar, the step bar and the topic search on `lab.html` all read this list. **When you add, rename or remove a section, update TOP.**

## What the shell builds

`lab.js` → `atlas()` works on `.page`:

```
.page.atlas
  aside.atl-side      ← area name, its topics (current one highlighted, with its sections), "All areas", other areas
  div.atl-main        ← everything the page had, moved in unchanged
    header.lhead      ← eyebrow "Virtual Labs · Area N · <area>", H1, lead, .lmeta (Applies to, Model and limitations, depth on phones, live status)
    nav.atl-bar       ← sticky step bar + depth switch (desktop)
    section …         ← lab content
    p.foot#limits     ← "Model and limitations" (existing id kept)
    nav.vlpath#next   ← "Next": next topic in the area, then the next area
```

- At 1200 px and wider the sidebar is 228 px. Containers on lab pages widen to 1520 px, so the content stays about 1070–1240 px wide.
- Below 1200 px the sidebar becomes a topic selector at the top of the page, and the step bar scrolls sideways.
- `.labnav` and `.snav` stay in the HTML but are hidden. The sidebar replaces both.

## Hooks for lab rebuilds

1. **Steps**: Understand · Explore · Try · Debrief · Check · Next.
   - Explicit hook: put `data-step="understand|explore|try|debrief|check"` on a section that has an `id`. If any element on the page has `data-step`, only the explicit steps count.
   - Without the hook, the step comes from TOP:
     - `quiz` → check
     - `drill` or `#try` → try
     - `sim` → explore
     - `read` before the first sim → understand
     - `read` after the first sim → debrief
   - A step with no section is shown greyed out and cannot be clicked ("Not yet in this lab"). Do not add filler to make it light up.
   - Next always points to `#next`.
   - The step bar links jump to the first section of their step. Scrolling highlights the current step and the current section.
2. **Depth**: Short · Deep dive · Instructor.
   - The choice is stored in `localStorage['vlab-depth']` and set as `body.depth-short|depth-deep|depth-instructor`. `site.js` sets the class before first paint.
   - Changing depth fires a `labdepth` event on `document` (detail = depth) and a `resize`.
   - Mark anything that is not needed in the short version with **`.deep`**. It is hidden in Short and in Instructor.
   - Instructor also hides `.lead`, `.callout`, `.ntip`, static `.card>p` without ids, and the header lead. Keep text that must stay visible in Instructor out of those, or give it an id.
   - Sections inside `.deep` also drop out of the sidebar and the scroll spy in Short and Instructor.
   - `pressure.html` (Pressure and wind) is the reference rebuild: explicit `data-step` on every section, `.deep` blocks, one `data-lab-model`, a Try section with live feedback, scenario presets for Instructor.
3. **Primary model**: put `data-lab-model` on the main interactive container (canvas wrapper).
   - Without it, the shell picks the first `.lab-model, .view, .paper, .viewport` outside `#quiz`.
   - The shell adds `.atl-model` to that element, and `.atl-split` to its closest `.split`.
   - In Instructor the split becomes one column, so the model gets the full width. Its canvas `max-height` is relaxed to `min(80vh, 820px)`.
   - Size canvases with `width:100%` plus `aspect-ratio` and re-fit on resize (`LAB.fit` does this).
4. **Model and limitations**: keep one `<p class="foot">` at the end of the content.
   - The meta row links to it. It gets the id `limits` unless it already has one.
5. **Tabs inside sections** (for example the propeller tabs) are untouched.
6. **Strings**: every string is EN/NO through `L({en,no})` or `LAB.add(dict, no)`. The shell redraws itself on `LAB.onLang`.
   - Rich prose (with `<b>`, links, `<sub>`): put the English HTML in the page with `data-tx="key"` and give the Norwegian with `LAB.tx({key:'…'})`.

## Rules

- Do not add progress tracking, done markers or counters to the labs or to `lab.html`.
- Keep file names and URLs. To regroup labs, edit `PATH` and the counts follow from it.
- When `lab.js`, `site.js` or `site.css` change, bump their `?v=` on every page that loads them.

## The standard (owner decision, Nov 2026): every lab looks like the wind tunnel

`tunnel.html` is the visual and structural standard for every lab. New and rebuilt labs copy it:

- **Three steps** in the bar: 1 Understand, 2 Explore, 3 Test yourself. `data-step` values `try` map to Explore and `debrief` to Test yourself (see `STEP3` in `lab.js`). "Next" is the end link, not a step.
- **Understand** = a *Key concepts* grid: small cards with a tiny illustration, a short title, one line, and "Show it in the model" that jumps to and highlights the right place/state. Longer text goes in `.deep`.
- **Explore** = control panel on the left (groups: Conditions / Show / Advanced, the tunnel's component styles), a dark premium viewport with the view tabs on top, a compact readout chip in a viewport corner, the legend in the viewport, a one-line "What you're seeing" under it, then the *Try it* tasks as small boxes.
- **Test yourself** = "Key points" ("Det viktigste") with at most one memory-aid card, then the quiz.
- Charts: plain-language "How to read this", key points labelled in words on the chart, a simple default view with "Show full chart" for the rest, and one take-away sentence.
- Aircraft drawings: refined and professional (the stability.html jet is the reference), sensibly sized, never filling the view.
- Tidy and clear overview first; depth is fine when it is organised and explained.

## The shared template, as built (Nov 2026)

Every lab gets these from the shell. A page only supplies its own subject content and model.

| Part | Where it comes from | Rule |
|---|---|---|
| Header | `pageHeader()` | Eyebrow "Virtual Labs · Area N · area", H1, one purpose paragraph, **Learning goal** (`p.goal`: the page's own, else `GOAL[key]` in `lab.js`), meta row. The goal styles live in `lab.css`; do not restyle them in a page. |
| Orientation | `atlas()` | Sidebar, sticky step bar, depth switch, "Next". Section eyebrows are rewritten from `data-step` to "1 · Understand", "2 · Explore", "3 · Test yourself"; text after a second "·" in the page's eyebrow is kept (for example "· A320 model"). |
| Order | page | Understand (Key concepts) → Explore (`.xapp`: viewport, `.xsee`, Controls panel, result cards, Try it) → Test yourself (H2 "Key points", then the quiz) → Practise it → Model and limitations → Next. |
| Hint | page | The `p.lead` under the Explore H2 says what you can move. `.xsee` under the viewport says what you are seeing and what changed. |
| Controls | `LAB.slider`, `LAB.seg` | Label left, value and unit right. Native range keys. Segments carry `aria-pressed`; sliders carry `aria-valuetext`. |
| View tabs | `a11y()` | `.vtabs[role=tablist]` buttons become tabs (`aria-selected`, roving tabindex, Left/Right/Home/End). |
| Reset | `LAB.reset(fn[, viewport])` | One "Reset" button, last in the viewport bar. `fn` returns the model to its starting values and keeps the current view, depth and language. `LAB.keep(S)` returns a function that restores a snapshot of a plain state object. Do not add a second Reset inside the panel. A "Restart" for a timed run is a transport control, not a Reset. |
| Canvas | `a11y()` | A canvas with `aria-label` gets `role="img"` (`application` if it is focusable). A chart canvas without a label is named by its card heading. Colour bars are `aria-hidden`. |
| Phones (≤900 px) | `lab.css` | Viewport first, then the Controls tray (`details.xpanel`): collapsed under the model, sticky at the bottom edge while the model is on screen, at most 58 % of the height when open. Touch targets are 44 px. |
| Live values | page | The read-out chip in the viewport is `aria-live="polite"`. The shell announces a Reset in `#labLive`. |

Known exceptions: `tunnel.html` keeps its own stylesheet and viewport bar (the Reset sits last in its tool row; its overlay buttons are 36 px on touch so they do not cover the scene). Secondary models further down `stability.html`, `propeller.html` and `radionav.html` (radar) still use the older `.split` layout without a viewport bar, so they have no Reset. `massbalance.html` keeps its light `.split` drawings; each of its two models has a light viewport bar (`.paper>.vbar`, styled in the page) carrying the shared Reset.
