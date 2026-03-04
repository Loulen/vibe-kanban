# Improve Mermaid Diagram Rendering — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Mermaid error DOM pollution and eliminate redundant re-renders during streaming.

**Architecture:** Add `suppressErrorRendering: true` to Mermaid init config to prevent DOM injection. Add a promise-based render cache in `mermaid.ts` keyed by diagram code so each unique diagram renders exactly once. Pass a detached container to `mermaid.render()` as a safety belt.

**Tech Stack:** Mermaid v11, React, Lexical, Playwright (E2E)

---

### Task 1: Enable `suppressErrorRendering` and add detached container

**Files:**
- Modify: `packages/ui/src/lib/mermaid.ts`

**Step 1: Update mermaid.ts with suppressErrorRendering and detached container**

Replace the entire file with:

```typescript
import mermaid from 'mermaid';

let isInitialized = false;
let renderCount = 0;

function ensureMermaidInitialized() {
  if (isInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    suppressErrorRendering: true,
  });

  isInitialized = true;
}

const renderCache = new Map<string, Promise<string>>();

export async function renderMermaidToSvg(code: string): Promise<string> {
  ensureMermaidInitialized();

  const cached = renderCache.get(code);
  if (cached) return cached;

  renderCount += 1;
  const id = `vk-mermaid-${renderCount}`;

  // Use a detached container so mermaid never touches the visible DOM on error
  const container = document.createElement('div');

  const promise = mermaid.render(id, code, container).then(({ svg }) => svg);

  renderCache.set(code, promise);

  // On failure, remove from cache so a retry with different code can work
  promise.catch(() => {
    renderCache.delete(code);
  });

  return promise;
}
```

**Step 2: Verify the E2E tests still pass**

Run: `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts`

Expected: All assertions pass, including:
- Valid diagrams render SVG
- Invalid diagrams show "Unable to render Mermaid diagram." error text
- No "Syntax error in text" appears anywhere in the page (line 28)
- Malicious diagrams have no javascript: links

**Step 3: Commit**

```bash
git add packages/ui/src/lib/mermaid.ts
git commit -m "fix(ui): cache Mermaid renders and suppress error DOM injection

Add suppressErrorRendering to prevent Mermaid from injecting error
elements into document.body. Use promise-based cache keyed by diagram
code so each unique diagram renders exactly once regardless of
component remounts during streaming."
```

---

### Task 2: Clean up any orphaned Mermaid error elements (defensive)

**Files:**
- Modify: `packages/ui/src/lib/mermaid.ts`

Even with `suppressErrorRendering: true`, Mermaid may create temporary container elements with IDs like `d${id}` or `dmermaid-${id}` in the document. Add a cleanup step after render to remove any orphaned elements.

**Step 1: Add cleanup after render**

In the `renderMermaidToSvg` function, after the `mermaid.render()` call resolves or rejects, clean up any leftover elements:

```typescript
  const promise = mermaid
    .render(id, code, container)
    .then(({ svg }) => svg)
    .finally(() => {
      // Remove any orphaned elements Mermaid may have added to <body>
      const orphan = document.getElementById(id);
      orphan?.remove();
      // Also remove the temp container's content
      container.remove();
    });
```

**Step 2: Run E2E tests**

Run: `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/ui/src/lib/mermaid.ts
git commit -m "fix(ui): clean up orphaned Mermaid DOM elements after render"
```

---

### Task 3: Format and lint

**Step 1: Run format**

Run: `pnpm run format`

**Step 2: Run lint**

Run: `pnpm run lint`

Expected: No errors related to our changes.

**Step 3: Commit if any formatting changes**

```bash
git add -A
git commit -m "style: format Mermaid render changes"
```

---

## Acceptance Criteria

1. **No DOM pollution on invalid diagrams**: Open the mermaid E2E harness (`/mermaid-e2e.html`). The invalid diagram section shows "Unable to render Mermaid diagram." text and a code block with the raw source. No "Syntax error in text" appears anywhere on the page. Verify: `page.getByText('Syntax error in text')` returns 0 matches.

2. **Render cache prevents redundant work**: In browser DevTools, add a `console.log` in `renderMermaidToSvg` before the `mermaid.render` call. During streaming with a Mermaid diagram, the log should fire exactly once per unique diagram code, not on every streaming patch.

3. **Multiple diagrams render independently**: If a message contains two Mermaid blocks, each renders once when its closing fence arrives. The cache key is the code content, so different diagrams get separate cache entries.

4. **E2E tests pass**: `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts` — all assertions green.
