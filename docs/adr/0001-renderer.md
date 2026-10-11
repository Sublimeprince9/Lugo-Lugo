# ADR 0001: Event map renderer choice

- Status: PixiJS prototype in progress; device benchmark pending
- Date: 2026-10-10

## Context

The app needs a mobile-first event map that can show a venue layout, stall markers, and filter interactions without feeling sluggish on low-end Android devices. The MVP is designed for UMA Showgrounds and should be reusable for other events.

## Current direction

Use PixiJS for the interactive pixel-art map prototype. The current canvas renders venue paths, zones, booths, and map labels, with stall selection, drag-to-pan, and zoom controls.

## Rationale

- PixiJS provides a canvas renderer suited to the pixel-art look and a growing number of interactive stall markers.
- Canvas rendering keeps the map surface independent from the rest of the React interface.
- The implementation remains a visual prototype; it is not yet based on the final venue floor plan or production event data.

## Consequences

- The map now has a PixiJS runtime dependency and should be tested on supported mobile browsers.
- Renderer choice is not considered final until FPS, load time, and touch behavior have been measured on low-end Android devices over throttled 3G.
- Replace the prototype geometry with the venue floor plan and real stall coordinates before the pilot.
