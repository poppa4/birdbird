# Virtual Labs: the Atlas lab template

Internal note. It is not linked from the site, and `functions/LAB-TEMPLATE.md.js` makes Pages answer 404 for it.

The site is static: plain HTML and vanilla JS with no build step. Every lab page loads `site.js` (first thing in `<body>`), then `lab.css` and `site.css`, and `lab.js` at the end. The page calls `LAB.start('<key>')` (or `LAB.head('<key>')`). The shell is built from `lab.js`, so a lab page needs no shell markup of its own.

## Information architecture (lab.js `PATH`)

- `PATH` holds seven areas in this order: `pof` Aerodynamics, `met` Meteorology and the atmosphere, `inst` Instruments, `nav` Navigation and instrument procedures, `sys` Aircraft and engine systems, `perf` Performance, `mb` Mass and balance. After them comes one entry with `more:true` (`hf` Human factors). That entry is not an area. It shows up only in the quiet "More" list on `lab.html`.
- `LAB.AREAS` lists the seven areas. `LAB.MORE` lists the More entries. `LAB.FLAT` lists all 25 labs.
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
   - Today no page uses `.deep`, so Short looks the same as Deep dive until labs are rebuilt.
3. **Primary model**: put `data-lab-model` on the main interactive container (canvas wrapper).
   - Without it, the shell picks the first `.lab-model, .view, .paper, .viewport` outside `#quiz`.
   - The shell adds `.atl-model` to that element, and `.atl-split` to its closest `.split`.
   - In Instructor the split becomes one column, so the model gets the full width. Its canvas `max-height` is relaxed to `min(80vh, 820px)`.
   - Size canvases with `width:100%` plus `aspect-ratio` and re-fit on resize (`LAB.fit` does this).
4. **Model and limitations**: keep one `<p class="foot">` at the end of the content.
   - The meta row links to it. It gets the id `limits` unless it already has one.
5. **Tabs inside sections** (for example the propeller tabs) are untouched.
6. **Strings**: every string is EN/NO through `L({en,no})` or `LAB.add(dict, no)`. The shell redraws itself on `LAB.onLang`.

## Rules

- Do not add progress tracking, done markers or counters to the labs or to `lab.html`.
- Keep file names and URLs. To regroup labs, edit `PATH` and the counts follow from it.
- When `lab.js`, `site.js` or `site.css` change, bump their `?v=` on every page that loads them.
