# Improve Mermaid Diagram Rendering

## Problem

Two issues with Mermaid diagram rendering during streaming:

1. **Error DOM pollution**: When `mermaid.render()` fails on invalid syntax, the Mermaid library injects error elements (e.g. "Syntax error in text") directly into `document.body`, outside our component tree. This breaks the app layout.

2. **Repeated re-rendering**: `MarkdownSyncPlugin` rebuilds the entire Lexical tree on every streaming patch via `$convertFromMarkdownString()`. Once a Mermaid code block's closing fence arrives, every subsequent patch recreates the `MermaidNode`, remounting the React component and re-triggering `renderMermaidToSvg` — causing flickering and compounding the error DOM pollution.

## Approach: Cache + Error Containment

### Render cache (packages/ui/src/lib/mermaid.ts)

Add a `Map<string, Promise<string>>` keyed by diagram code. On cache hit, return the existing promise. This ensures each unique diagram is rendered exactly once, regardless of how many times the component remounts.

Use a promise-based cache (not result-based) so that concurrent calls for the same code share a single in-flight render rather than racing.

### Error containment (packages/ui/src/lib/mermaid.ts)

Before calling `mermaid.render()`, create a temporary detached container `<div>` and pass it as the render target. This prevents Mermaid from injecting error elements into `document.body`. After rendering, discard the container.

If the Mermaid API doesn't support a container argument for error output, clean up any injected error elements from `document.body` after each render call (look for `#d${id}` elements or `.error-icon` / `[id^="d"]` selectors that Mermaid uses).

### Error display (packages/ui/src/components/mermaid-node.tsx)

On render failure, show the raw code as a fenced code block fallback (matching the existing E2E test expectation that `<pre><code>` with the raw code is shown). Keep the "Unable to render Mermaid diagram." text error.

## Files Changed

| File | Change |
|------|--------|
| `packages/ui/src/lib/mermaid.ts` | Add render cache + error containment |
| `packages/ui/src/components/mermaid-node.tsx` | No changes needed (cache makes re-renders instant) |

## Risks

- Mermaid's error injection behavior may vary across versions. The cleanup approach should be defensive.
- The cache grows unbounded during a session. Acceptable since diagram count per session is small. Could add LRU if needed later.
