# Auto-Discover AI Artefacts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pre-populate new (and backfill existing) repos with a default setup script that aggregates CLAUDE.md files and .claude/skills/ symlinks from repo subdirectories to the workspace root, so Claude Code can discover them.

**Architecture:** A shell script stored as `assets/scripts/default-setup-script.sh`, loaded at compile time via `include_str!()` into a Rust constant, referenced from `Repo::find_or_create`. A SQL migration backfills existing repos with NULL setup_script.

**Tech Stack:** Rust (SQLx, sqlx::query_as!), SQLite migrations, Bash

---

### Task 1: Create the default setup script file

**Files:**
- Create: `assets/scripts/default-setup-script.sh`

**Step 1: Create the script file**

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

**Step 2: Verify the file is valid bash**

Run: `bash -n assets/scripts/default-setup-script.sh`
Expected: No output (no syntax errors)

**Step 3: Commit**

```bash
git add assets/scripts/default-setup-script.sh
git commit -m "feat: add default setup script for AI artefact discovery"
```

**Acceptance Criteria:**
- `bash -n assets/scripts/default-setup-script.sh` exits 0 (valid syntax)
- File exists at `assets/scripts/default-setup-script.sh`

---

### Task 2: Add DEFAULT_SETUP_SCRIPT constant and update find_or_create

**Files:**
- Modify: `crates/db/src/models/repo.rs:1` (add constant at top of file, before structs)
- Modify: `crates/db/src/models/repo.rs:231-254` (update `find_or_create` SQL INSERT)

**Step 1: Add the constant**

At the top of `crates/db/src/models/repo.rs`, after the imports, add:

```rust
/// Default setup script that discovers and aggregates AI artefacts
/// (CLAUDE.md, .claude/skills) from repo subdirectories into the workspace root.
pub const DEFAULT_SETUP_SCRIPT: &str =
    include_str!("../../../../assets/scripts/default-setup-script.sh");
```

**Step 2: Update `find_or_create` to include `setup_script` in the INSERT**

Change the INSERT statement from:

```rust
r#"INSERT INTO repos (id, path, name, display_name)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT(path) DO UPDATE SET updated_at = updated_at
```

To:

```rust
r#"INSERT INTO repos (id, path, name, display_name, setup_script)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT(path) DO UPDATE SET updated_at = updated_at
```

And add `DEFAULT_SETUP_SCRIPT` as the 5th bind parameter:

```rust
            id,
            path_str,
            repo_name,
            display_name,
            DEFAULT_SETUP_SCRIPT,
```

**Step 3: Verify it compiles**

Run: `cargo check -p db`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add crates/db/src/models/repo.rs
git commit -m "feat: pre-populate setup_script with AI artefact discovery for new repos"
```

**Acceptance Criteria:**
- `cargo check -p db` exits 0
- `cargo test -p db` passes (no regressions)

---

### Task 3: Add SQL migration to backfill existing repos

**Files:**
- Create: `crates/db/migrations/20260304000000_backfill_default_setup_script.sql`

**Step 1: Create the migration file**

The migration sets `setup_script` for all repos where it is currently NULL. The script content must be embedded as a SQL string literal (with single quotes escaped by doubling them).

```sql
-- Backfill existing repos with the default AI artefact discovery setup script.
-- Only updates repos that have no setup script configured.
UPDATE repos
SET setup_script = '#!/bin/bash
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

# Symlink skills from each repo''s .claude/skills/ into workspace root
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
done',
    updated_at = datetime('now', 'subsec')
WHERE setup_script IS NULL;
```

Note: The `''` on `repo's` is SQL escaping for single quotes within a string literal.

**Step 2: Verify the migration is valid SQL**

Run: `sqlite3 :memory: ".read crates/db/migrations/20260304000000_backfill_default_setup_script.sql"` — this will fail because the `repos` table doesn't exist in an empty DB, but it should NOT fail with a SQL syntax error. The expected error is "no such table: repos".

**Step 3: Commit**

```bash
git add crates/db/migrations/20260304000000_backfill_default_setup_script.sql
git commit -m "feat: backfill existing repos with default AI artefact discovery setup script"
```

**Acceptance Criteria:**
- Migration file exists at expected path
- SQL is syntactically valid (no parse errors, only "no such table" when tested against empty DB)
- `cargo check -p db` still passes after adding the migration

---

### Task 4: Full build verification and format

**Files:**
- None new — verification only

**Step 1: Run full workspace cargo check**

Run: `cargo check --workspace`
Expected: Compiles without errors

**Step 2: Run Rust tests**

Run: `cargo test --workspace`
Expected: All tests pass

**Step 3: Format code**

Run: `pnpm run format`
Expected: No formatting errors

**Step 4: Final commit if formatting changed anything**

```bash
git add -A
git commit -m "style: format code"
```

**Acceptance Criteria:**
- `cargo check --workspace` exits 0
- `cargo test --workspace` exits 0 with no failures
- `pnpm run format` exits 0
