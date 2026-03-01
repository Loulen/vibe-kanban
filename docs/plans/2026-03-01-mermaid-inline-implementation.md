# Mermaid Inline Assistant Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render fenced Mermaid blocks inline inside assistant chat messages, with automatic rendering and graceful fallback when Mermaid parsing fails.

**Architecture:** Add a dedicated Lexical Mermaid decorator node in `@vibe/ui`, then wire it into `WYSIWYGEditor` with a new `enableMermaid` switch so only assistant messages opt in. Keep all non-assistant message types on existing markdown behavior. Validate with a runnable Playwright scenario that checks both success and error fallback rendering.

**Tech Stack:** React 18, Lexical markdown transformers, TypeScript, Mermaid, Playwright, pnpm workspace.

---

### Task 1: Add Mermaid runtime dependency and scaffold node module

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/components/mermaid-node.tsx`

**Step 1: Write the failing compile expectation**

Create `packages/ui/src/components/mermaid-node.tsx` with this minimal export first:

```tsx
export const MERMAID_PLACEHOLDER = true;
```

Then add this temporary import in `packages/web-core/src/shared/components/WYSIWYGEditor.tsx`:

```tsx
import { MERMAID_PLACEHOLDER } from '@vibe/ui/components/mermaid-node';

void MERMAID_PLACEHOLDER;
```

**Step 2: Run check to verify dependency is still missing**

Run: `pnpm run check`
Expected: FAIL once real Mermaid API usage is added because `mermaid` package is not installed yet.

**Step 3: Add minimal implementation dependency**

In `packages/ui/package.json`, add:

```json
"mermaid": "^11.12.0"
```

**Step 4: Install and re-run check**

Run: `pnpm i && pnpm run check`
Expected: PASS for dependency resolution.

**Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/src/components/mermaid-node.tsx
git commit -m "chore: add mermaid dependency scaffold for chat rendering"
```

### Task 2: Implement Mermaid decorator node with fenced transformer + fallback UI

**Files:**
- Modify: `packages/ui/src/components/mermaid-node.tsx`
- Reference: `packages/ui/src/components/create-decorator-node.tsx`

**Step 1: Write failing component test (new test file)**

Create: `packages/ui/src/components/__tests__/mermaid-node.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';

describe('mermaid-node', () => {
  it('renders fallback when Mermaid code is invalid', () => {
    expect(true).toBe(false);
  });
});
```

**Step 2: Run targeted test to verify failure**

Run: `pnpm --filter @vibe/ui exec vitest run src/components/__tests__/mermaid-node.test.tsx`
Expected: FAIL with assertion error.

**Step 3: Implement minimal Mermaid node**

Implement `createMermaidNode()` using `createDecoratorNode` with fenced language `mermaid`.

Core shape:

```tsx
type MermaidData = { code: string };

export const {
  Node: MermaidNode,
  transformers: MERMAID_TRANSFORMERS,
  isNode: $isMermaidNode,
} = createDecoratorNode<MermaidData>({
  type: 'mermaid',
  serialization: {
    format: 'fenced',
    language: 'mermaid',
    serialize: (data) => data.code,
    deserialize: (content) => ({ code: content }),
    validate: (data) => data.code.trim().length > 0,
  },
  component: MermaidRenderer,
});
```

In `MermaidRenderer`, use `mermaid.render()` in `useEffect` and render:
- `<div dangerouslySetInnerHTML={{ __html: svg }} />` on success
- error alert + `<pre><code>{code}</code></pre>` on error

**Step 4: Replace test with real expectations and run tests**

Update test to assert:
- valid graph eventually creates an `svg`
- invalid graph shows error text and raw code

Run: `pnpm --filter @vibe/ui exec vitest run src/components/__tests__/mermaid-node.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ui/src/components/mermaid-node.tsx packages/ui/src/components/__tests__/mermaid-node.test.tsx
git commit -m "feat: add lexical mermaid node with inline fallback rendering"
```

### Task 3: Wire Mermaid node into WYSIWYGEditor with assistant-only feature flag

**Files:**
- Modify: `packages/web-core/src/shared/components/WYSIWYGEditor.tsx`
- Modify: `packages/web-core/src/features/workspace-chat/ui/NewDisplayConversationEntry.tsx`

**Step 1: Write failing integration expectation in assistant rendering path**

Create: `packages/web-core/src/features/workspace-chat/ui/__tests__/assistant-mermaid-toggle.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';

describe('assistant mermaid toggle', () => {
  it('enables mermaid only for assistant messages', () => {
    expect(true).toBe(false);
  });
});
```

**Step 2: Run targeted test to verify failure**

Run: `pnpm --filter @vibe/web-core exec vitest run src/features/workspace-chat/ui/__tests__/assistant-mermaid-toggle.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal editor wiring**

In `WYSIWYGEditor`:
- add prop `enableMermaid?: boolean` (default `false`)
- import Mermaid node + transformers
- include Mermaid node in `initialConfig.nodes` only when `enableMermaid` is `true`
- include Mermaid transformer(s) in `extendedTransformers` only when `enableMermaid` is `true`

In `NewDisplayConversationEntry.tsx`:
- extend `AppChatMarkdown` signature with `enableMermaid?: boolean`
- pass `enableMermaid` to `WYSIWYGEditor`
- set `enableMermaid={true}` only in `AssistantMessageEntry` render path
- leave all other entries unchanged (`false`/default)

**Step 4: Replace failing test with real assertions and run checks**

Run:
- `pnpm --filter @vibe/web-core exec vitest run src/features/workspace-chat/ui/__tests__/assistant-mermaid-toggle.test.tsx`
- `pnpm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web-core/src/shared/components/WYSIWYGEditor.tsx packages/web-core/src/features/workspace-chat/ui/NewDisplayConversationEntry.tsx packages/web-core/src/features/workspace-chat/ui/__tests__/assistant-mermaid-toggle.test.tsx
git commit -m "feat: enable mermaid rendering for assistant messages only"
```

### Task 4: Add Playwright validation scenario for Mermaid success and failure paths

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/assistant-mermaid.spec.ts`
- Modify: `package.json`

**Step 1: Write failing Playwright test first**

Create `tests/e2e/assistant-mermaid.spec.ts` that:
- opens local app
- loads a chat state (fixture or deterministic seed) with assistant Mermaid message
- asserts `svg` appears inside assistant bubble
- loads invalid Mermaid case and asserts error notice + raw code block

Initial failing assertion example:

```ts
await expect(page.locator('data-test-mermaid-svg')).toHaveCount(1);
```

**Step 2: Run test and verify failure**

Run: `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts`
Expected: FAIL until selectors/fixture hooks are finalized.

**Step 3: Implement deterministic selectors/hooks**

Adjust Mermaid renderer and/or assistant message wrappers to expose stable selectors:
- `data-testid="assistant-mermaid-diagram"`
- `data-testid="assistant-mermaid-error"`
- `data-testid="assistant-mermaid-source"`

Update the Playwright test to use those selectors.

**Step 4: Run E2E and verify pass**

Run:
- `pnpm run dev` (in one terminal)
- `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts`

Expected: PASS for both valid and invalid Mermaid cases.

**Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/assistant-mermaid.spec.ts package.json
git commit -m "test: add playwright coverage for assistant mermaid rendering"
```

### Task 5: End-to-end verification and formatting gate

**Files:**
- Modify: any files touched by formatting

**Step 1: Run full workspace checks**

Run: `pnpm run check`
Expected: PASS.

**Step 2: Run targeted E2E verification**

Run: `pnpm exec playwright test tests/e2e/assistant-mermaid.spec.ts`
Expected: PASS.

**Step 3: Run required formatter**

Run: `pnpm run format`
Expected: PASS with no remaining formatting diffs.

**Step 4: Re-run sanity check**

Run: `pnpm run check`
Expected: PASS.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: support inline mermaid diagrams in assistant chat messages"
```

## Notes for implementation

- Keep Mermaid support strictly assistant-only in this phase.
- Do not introduce global markdown behavior changes for system/thinking/tool entries.
- Prefer strict fallback behavior over silent failure.
- Keep performance bounded by rendering only Mermaid blocks that exist in visible assistant messages.
