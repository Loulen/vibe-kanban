# Mermaid Diagram Zoom Design

## Context

Conversation messages can include Mermaid diagrams interpreted from prior agent output. Users need to inspect large diagrams in detail without losing readability in the inline chat flow.

## Goals

- Let users click an inline Mermaid diagram in conversation to open a large modal viewer.
- Keep modal close behavior consistent with existing app modals.
- Support easy diagram navigation with pan and zoom.
- Provide explicit zoom controls: zoom in, zoom out, and reset.

## Non-Goals

- Adding a generic media viewer for every block type.
- Reworking unrelated markdown rendering flows.
- Introducing custom modal behavior that diverges from `KeyboardDialog`.

## Selected Approach

Use a Mermaid-specific rendering path that preserves current inline behavior and adds click-to-open fullscreen inspection.

### Why this approach

- Smallest targeted change for requested UX.
- Low regression risk because it layers on top of existing conversation rendering.
- Reuses shared modal behavior (Esc, overlay click, close icon) via `KeyboardDialog`.

## Architecture

1. Add Mermaid fenced-block support in the markdown/Lexical pipeline where custom nodes are already registered.
2. Render Mermaid inline through a dedicated decorator component that:
   - draws the diagram,
   - indicates clickability (`cursor-zoom-in`),
   - opens a dedicated modal on click.
3. Add `MermaidZoomDialog` built on `KeyboardDialog` with large content area.
4. Implement modal-local pan/zoom state and controls (`+`, `-`, `Reset`).

## Interaction and Data Flow

1. Conversation entry markdown is parsed by existing editor transformers.
2. Mermaid fenced blocks map to a Mermaid node containing raw Mermaid source.
3. The node decorator renders inline SVG for normal reading.
4. Clicking the inline diagram opens `MermaidZoomDialog.show({ code })`.
5. Modal renders the same diagram in a large viewport (target about `90vw x 85vh`).
6. User interactions inside modal:
   - wheel/trackpad zoom centered on pointer,
   - drag-to-pan,
   - button zoom in/out,
   - reset to initial fit transform.
7. Closing follows standard modal behavior from `KeyboardDialog`.

## Zoom/Pan Behavior

- Maintain transform state as `scale`, `translateX`, `translateY` in modal.
- Compute an initial fit-to-container transform when modal opens.
- Clamp scale to safe bounds (for example `0.2` to `4.0`).
- Reset action restores initial fit transform and centered view.

## Error Handling

- If Mermaid rendering fails (invalid syntax or parse/runtime error), display a clear fallback message instead of blank output.
- Keep failures contained to the Mermaid component so conversation rendering remains stable.
- Show same fallback behavior in modal.

## Accessibility

- Inline diagram wrapper exposes button semantics and keyboard activation (Enter/Space).
- Modal controls include clear accessible labels.
- Modal focus and escape behavior rely on existing `KeyboardDialog` conventions.

## Testing Strategy

### Unit and Component Tests

- Mermaid fenced block transforms into expected node shape.
- Clicking inline Mermaid opens zoom dialog.
- `+`, `-`, and `Reset` update transform state correctly.
- Error fallback renders on malformed Mermaid input.

### Playwright MCP End-to-End

After starting the server, run Playwright MCP validation that:

1. Opens a conversation containing a Mermaid diagram.
2. Clicks the inline diagram and verifies modal appears.
3. Verifies modal occupies most of viewport.
4. Exercises zoom in, zoom out, and reset controls.
5. Verifies panning updates viewport position.
6. Verifies close behavior via close icon and Esc (and overlay click per shared modal behavior).

## Risks and Mitigations

- **Risk:** Mermaid renderer differences between inline and modal.
  - **Mitigation:** Reuse the same render utility/component for both contexts.
- **Risk:** Poor performance on very large diagrams.
  - **Mitigation:** Keep transform updates lightweight and avoid rerendering full markdown tree.
- **Risk:** Modal behavior drift from app conventions.
  - **Mitigation:** Use existing `KeyboardDialog` instead of custom overlay implementation.

## Implementation Notes

- Keep Mermaid feature isolated to relevant markdown/node components.
- Avoid introducing global state; modal-local state is sufficient.
- Follow existing UI token usage and button primitives in `packages/ui`.

## Acceptance Criteria

- User can click any Mermaid diagram shown in conversation and open a large modal.
- Modal supports pan and zoom with both gesture and explicit button controls.
- Modal has a visible close icon and matches app-standard close behavior.
- Invalid Mermaid does not crash conversation rendering and shows fallback feedback.
