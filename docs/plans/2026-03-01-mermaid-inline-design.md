# Mermaid inline rendering in assistant messages

## Context

Vibe Kanban already renders markdown content through `WYSIWYGEditor` (Lexical) in chat entries.
The requested feature is to render Mermaid diagrams inline, directly inside assistant responses, similarly to Cline/RooCode behavior.

## Scope

### In scope (MVP)

- Render Mermaid only in assistant messages.
- Support fenced markdown blocks only:

  ```markdown
  ```mermaid
  graph TD
  A --> B
  ```
  ```

- Render automatically on display (no user toggle).
- On Mermaid render error: show an error notice and keep raw Mermaid code visible below.

### Out of scope (MVP)

- Mermaid rendering in system/thinking/tool messages.
- Non-fenced Mermaid syntaxes.
- Export-to-image features.

## Approaches considered

1. **Lexical DecoratorNode for Mermaid (recommended)**
   - Add a Mermaid custom node + fenced transformer integrated into existing Lexical markdown flow.
   - Pros: architecture-aligned, typed, reusable, avoids fragile DOM post-processing.
   - Cons: slightly more upfront implementation work.

2. **DOM post-processing of rendered code blocks**
   - Scan rendered output for `language-mermaid` code blocks and replace with SVG.
   - Pros: fast to prototype.
   - Cons: fragile with rerenders/virtualization and hard to maintain.

3. **Separate markdown pipeline for assistant messages**
   - Bypass Lexical rendering for assistant content and use remark/rehype stack.
   - Pros: direct control of markdown rendering pipeline.
   - Cons: duplicate rendering architecture and behavior drift.

Recommended approach: **Approach 1**.

## Design

## Architecture

- Add a Mermaid custom decorator node in `packages/ui/src/components/mermaid-node.tsx` using the existing `createDecoratorNode` factory.
- Serialization format: fenced block with language `mermaid`.
- The node component renders either:
  - generated Mermaid SVG (success path), or
  - error UI + raw code block (failure path).
- Register Mermaid node and transformers in `WYSIWYGEditor` (`initialConfig.nodes` and `extendedTransformers`).
- Add Mermaid package dependency in the frontend package where runtime rendering occurs.

## Data flow

1. Assistant message markdown is passed into read-only `WYSIWYGEditor`.
2. Markdown transformer detects fenced Mermaid blocks.
3. Mermaid blocks become Mermaid decorator nodes.
4. Decorator node renders Mermaid SVG inline in the same content position.
5. If render fails, decorator node shows error + raw mermaid source block.

## Assistant-only gating

- Keep Mermaid node registration global in editor internals.
- Gate actual Mermaid rendering at assistant message call sites by passing a render capability flag from assistant entry path.
- For non-assistant contexts in MVP, Mermaid fenced blocks remain presented as raw code blocks.

## Error handling

- Catch Mermaid parse/render errors per diagram instance.
- Display a compact inline error state in the assistant message.
- Always show original Mermaid source below the error for recovery/copying.
- Prevent one diagram failure from affecting other markdown content.
- Use strict Mermaid security mode.

## Testing strategy

## 1) Unit/logic tests

- Validate fenced Mermaid parse/transform behavior for supported syntax.
- Validate unsupported or malformed blocks route to error fallback path.

## 2) Component tests

- Mermaid node renders SVG for valid definitions.
- Mermaid node renders error notice + raw code for invalid definitions.
- Non-Mermaid fenced blocks remain unchanged.

## 3) Integration tests

- Verify assistant message path enables Mermaid rendering.
- Verify system/thinking/tool message paths do not enable Mermaid in MVP.

## 4) E2E verification (Playwright)

- Launch app locally.
- Inject/render assistant message containing valid Mermaid block and assert inline SVG presence.
- Inject/render assistant message containing invalid Mermaid block and assert error notice + raw code visibility.

## Verification commands before completion

- `pnpm run check`
- relevant test command(s) for new Mermaid node/tests
- Playwright scenario for assistant message Mermaid rendering
- `pnpm run format`

## Risks and mitigations

- **Render performance on long chats**: render per-node, memoized by source.
- **Client-only rendering mismatch**: keep rendering confined to read-only display path with safe fallback.
- **Mermaid version behavior drift**: pin Mermaid version and cover key grammar in tests.

## Branching and integration workflow

- Keep this work on a dedicated feature branch (current worktree branch).
- Regularly re-sync from `main` to reduce drift.
- No PR required for now, per request.
