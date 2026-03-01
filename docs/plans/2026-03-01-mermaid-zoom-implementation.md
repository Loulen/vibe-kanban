# Mermaid Diagram Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Mermaid diagrams in conversation clickable so they open in a large modal with pan, zoom, and explicit `+`, `-`, `Reset` controls, with standard modal close behavior.

**Architecture:** Add a Mermaid fenced-block decorator node to the Lexical markdown pipeline used by read-only conversation rendering. The decorator renders inline Mermaid SVG and opens a dedicated `KeyboardDialog`-based zoom viewer on click. Keep transform state local to the modal and reuse existing modal UX conventions.

**Tech Stack:** React, TypeScript, Lexical markdown transformers, `@ebay/nice-modal-react`, `@vibe/ui` `KeyboardDialog`, Mermaid renderer, Playwright MCP for browser verification.

---

### Task 1: Add Mermaid rendering utility and dependency

**Files:**
- Modify: `packages/web-core/package.json`
- Create: `packages/web-core/src/shared/lib/mermaid.ts`

**Step 1: Write the failing test**

Create `packages/web-core/src/shared/lib/mermaid.test.ts` with a test that expects a helper like `renderMermaidToSvg('graph TD; A-->B;')` to return an SVG string.

```ts
import { describe, expect, it } from 'vitest';
import { renderMermaidToSvg } from './mermaid';

describe('renderMermaidToSvg', () => {
  it('returns svg markup for valid mermaid input', async () => {
    const svg = await renderMermaidToSvg('graph TD; A-->B;');
    expect(svg).toContain('<svg');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/lib/mermaid.test.ts`
Expected: FAIL because helper and/or test setup does not exist yet.

**Step 3: Write minimal implementation**

Implement `renderMermaidToSvg` in `packages/web-core/src/shared/lib/mermaid.ts` using Mermaid API with one-time `initialize`, deterministic IDs, and safe parse failure handling.

```ts
import mermaid from 'mermaid';

let initialized = false;

export async function renderMermaidToSvg(code: string): Promise<string> {
  if (!initialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    initialized = true;
  }

  const id = `vk-mermaid-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/lib/mermaid.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web-core/package.json packages/web-core/src/shared/lib/mermaid.ts packages/web-core/src/shared/lib/mermaid.test.ts
git commit -m "feat(web-core): add mermaid svg render utility"
```

### Task 2: Add Mermaid decorator node for fenced markdown

**Files:**
- Create: `packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx`
- Modify: `packages/web-core/src/shared/components/WYSIWYGEditor.tsx`

**Step 1: Write the failing test**

Create `packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx` that verifies fenced block parsing for:

```md
```mermaid
graph TD
  A --> B
```
```

Expected result: custom Mermaid decorator node is created/rendered.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx`
Expected: FAIL because Mermaid node does not exist.

**Step 3: Write minimal implementation**

Implement Mermaid decorator node with `createDecoratorNode` pattern:
- fenced language: `mermaid`
- data payload: `{ code: string }`
- inline renderer: uses `renderMermaidToSvg`
- fallback UI for render errors

Wire it into `WYSIWYGEditor.tsx`:
- register Mermaid node in `initialConfig.nodes`
- add Mermaid transformers to `extendedTransformers`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx packages/web-core/src/shared/components/WYSIWYGEditor.tsx packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx
git commit -m "feat(web-core): add mermaid fenced-block node"
```

### Task 3: Add Mermaid zoom modal with pan/zoom controls

**Files:**
- Create: `packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx`
- Modify: `packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx`

**Step 1: Write the failing test**

Create `packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx` covering:
- modal opens with svg content,
- `+` increases scale,
- `-` decreases scale,
- `Reset` returns initial transform.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx`
Expected: FAIL because dialog does not exist.

**Step 3: Write minimal implementation**

Implement `MermaidZoomDialog` using `KeyboardDialog` and `NiceModal`:
- large dialog content area (`max-w-[90vw]`, target height about `85vh`)
- close icon from dialog shell
- internal viewport supporting:
  - wheel zoom centered on pointer,
  - pointer drag pan,
  - `+`, `-`, `Reset` button controls.

Update Mermaid node click handler to call `MermaidZoomDialog.show({ code })`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx
git commit -m "feat(web-core): add mermaid zoom dialog with pan and zoom controls"
```

### Task 4: Accessibility and error-state hardening

**Files:**
- Modify: `packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx`
- Modify: `packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx`

**Step 1: Write the failing test**

Add assertions for:
- inline trigger has keyboard activation (Enter/Space),
- inline trigger has accessible label,
- invalid Mermaid code renders fallback text,
- controls expose accessible names.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx`
Expected: FAIL on missing a11y/error requirements.

**Step 3: Write minimal implementation**

Add:
- `role="button"`, `tabIndex={0}`, `aria-label="Open Mermaid diagram"` on inline wrapper,
- key handling for Enter and Space,
- fallback render blocks for parse/render failures,
- ARIA labels for zoom control buttons.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @vibe/web-core exec vitest run packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx packages/web-core/src/shared/components/wysiwyg/mermaid-node.test.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.test.tsx
git commit -m "fix(web-core): harden mermaid viewer accessibility and fallback states"
```

### Task 5: End-to-end verification with Playwright MCP after server start

**Files:**
- Create: `docs/plans/2026-03-01-mermaid-zoom-playwright-checklist.md`

**Step 1: Write the failing test**

Write a deterministic Playwright MCP checklist with concrete assertions that should fail before implementation:
- modal absent on click,
- no zoom controls,
- no pan interaction.

**Step 2: Run verification to confirm failure (before feature is complete)**

Run server: `pnpm run dev`.

Then run Playwright MCP steps:
1. Navigate to the app/workspace with Mermaid conversation content.
2. Click inline Mermaid diagram.
3. Assert modal appears and occupies most of viewport.
4. Click `+`, `-`, `Reset`; assert transform changes and reset restores baseline.
5. Drag diagram; assert position changes.
6. Close with X and Esc and verify modal hides.

Expected before full implementation: one or more assertions fail.

**Step 3: Write minimal implementation updates if any gaps remain**

Address any discovered E2E gaps in:
- `packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx`
- `packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx`

**Step 4: Re-run verification to confirm pass**

Re-run Playwright MCP checklist after fixes.
Expected: all assertions pass.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-01-mermaid-zoom-playwright-checklist.md packages/web-core/src/shared/components/wysiwyg/mermaid-node.tsx packages/web-core/src/shared/dialogs/wysiwyg/MermaidZoomDialog.tsx
git commit -m "test(web-core): validate mermaid zoom flow with playwright mcp"
```

### Task 6: Final validation and formatting

**Files:**
- Modify: any files touched in previous tasks

**Step 1: Run formatting**

Run: `pnpm run format`
Expected: no formatter errors.

**Step 2: Run type checks**

Run: `pnpm run check`
Expected: PASS.

**Step 3: Run lint**

Run: `pnpm run lint`
Expected: PASS.

**Step 4: Run Playwright MCP smoke pass (post-format)**

With server running, execute the same modal open/zoom/pan/close checks once more to ensure no regressions.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(web-core): add clickable mermaid zoom modal in conversation"
```
