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
