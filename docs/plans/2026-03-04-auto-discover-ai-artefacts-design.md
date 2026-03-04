# Auto-Discover AI Artefacts — Design

## Problem

When VK creates a workspace, repos are cloned into subdirectories under the workspace root:

```
workspace_root/
  repo-a/
    CLAUDE.md
    .claude/skills/
  repo-b/
    CLAUDE.md
```

Claude Code boots at `workspace_root/`, so it cannot see `CLAUDE.md` or `.claude/skills/` files nested inside repo subdirectories. These AI artefacts need to be aggregated up to the workspace root level.

## Solution

Provide a **default setup script** that automatically discovers and aggregates AI artefacts from repo subdirectories into the workspace root. This script is pre-populated into every repo's `setup_script` field so it runs automatically when workspaces are created.

## Default Setup Script

Stored as a standalone file at `assets/default-setup-script.sh`, loaded at compile time via `include_str!()`.

The script:
1. Concatenates all root-level `CLAUDE.md` files from direct repo subdirectories into a single `$WORKSPACE_ROOT/CLAUDE.md`, prefixed with repo name headers.
2. Symlinks each repo's `.claude/skills/` subdirectories into `$WORKSPACE_ROOT/.claude/skills/`, namespaced by repo name to avoid collisions.

```bash
#!/bin/bash
# Auto-discover AI artefacts (CLAUDE.md, .claude/skills) from repo subdirectories
WORKSPACE_ROOT="$(dirname "$PWD")"

# Concatenate CLAUDE.md files from repo subdirectories into workspace root
> "$WORKSPACE_ROOT/CLAUDE.md"
for repo_dir in "$WORKSPACE_ROOT"/*/; do
  repo_name=$(basename "$repo_dir")
  if [ -f "$repo_dir/CLAUDE.md" ]; then
    echo "# ${repo_name} INSTRUCTIONS" >> "$WORKSPACE_ROOT/CLAUDE.md"
    echo "" >> "$WORKSPACE_ROOT/CLAUDE.md"
    cat "$repo_dir/CLAUDE.md" >> "$WORKSPACE_ROOT/CLAUDE.md"
    echo "" >> "$WORKSPACE_ROOT/CLAUDE.md"
  fi
done

# Symlink skills from each repo's .claude/skills/ into workspace root
mkdir -p "$WORKSPACE_ROOT/.claude/skills"
for repo_dir in "$WORKSPACE_ROOT"/*/; do
  repo_name=$(basename "$repo_dir")
  if [ -d "$repo_dir/.claude/skills" ]; then
    for skill_dir in "$repo_dir/.claude/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name=$(basename "$skill_dir")
      ln -sfn "$skill_dir" "$WORKSPACE_ROOT/.claude/skills/${repo_name}-${skill_name}"
    done
  fi
done
```

## Changes

### 1. New file: `assets/default-setup-script.sh`
The script above.

### 2. `crates/db/src/models/repo.rs`
- Add `pub const DEFAULT_SETUP_SCRIPT: &str = include_str!("../../../../assets/default-setup-script.sh");`
- Modify `Repo::find_or_create` INSERT to set `setup_script` to `DEFAULT_SETUP_SCRIPT` for new repos.

### 3. New migration: `crates/db/migrations/YYYYMMDD_backfill_default_setup_script.sql`
- `UPDATE repos SET setup_script = '<script content>' WHERE setup_script IS NULL;`
- Backfills existing repos that have no setup script configured.

## Behavior

- **New repos**: Get the default setup script at registration time. Visible and editable in Settings immediately.
- **Existing repos (NULL setup_script)**: Backfilled by migration.
- **Existing repos (custom setup_script)**: Untouched.
- **Users can clear it**: Setting `setup_script` to empty/null in the UI removes it, same as today.

## Edge Cases

- **Repo with no CLAUDE.md or .claude/skills**: Script is a no-op for that repo (guarded by `if [ -f ]` / `[ -d ]`).
- **Single-repo workspace**: Script still runs — copies the repo's CLAUDE.md up to workspace root where Claude Code can see it.
- **Only direct subfolders scanned**: No recursive search. Only `$WORKSPACE_ROOT/*/CLAUDE.md`.
- **Workspace CLAUDE.md is regenerated each run**: It's a generated aggregate, not hand-written content.
- **Migration idempotency**: `WHERE setup_script IS NULL` is safe to run multiple times.
