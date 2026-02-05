---
description: Analyze git changes, determine optimal commit strategy, craft Conventional Commits messages, and commit changes autonomously
subtask: true
---

Please perform the following steps carefully to create high-quality git commits:

1. Run `git status` to examine the current repository state, including staged, unstaged, and untracked files.

2. Inspect the detailed changes:
   - Staged changes: review the full `git diff --staged`
   - Unstaged changes: review the full `git diff`
   - Untracked files: list and review their contents if relevant

3. Deeply analyze the purpose, impact, and nature of all changes in the codebase, including staged, unstaged, and untracked files.

4. Determine the optimal commit strategy based on the analysis:
   - Identify logical groups of changes (e.g., by feature, bug fix, refactor, documentation). Changes should be grouped if they are cohesive and achieve a single purpose.
   - Decide whether to:
     - Commit staged changes as-is if they form a complete, logical unit.
     - Stage additional unstaged/untracked changes that belong to the same logical group as staged changes.
     - Split changes into multiple commits if they represent distinct logical units (e.g., one for feat, one for fix).
     - Stage and commit unstaged changes separately if no staged changes exist but changes are ready.
     - Ignore or recommend ignoring irrelevant changes (e.g., temporary files).
   - Prioritize small, atomic commits that are easy to review and revert.
   - If no changes are ready or logical to commit, inform the user and suggest actions (e.g., staging specific files).

5. For each identified commit group:
   - Stage the relevant files if not already staged (using `git add <files>` or `git add -A` if appropriate).
   - Craft a detailed commit message that strictly follows the Conventional Commits specification (v1.0.0).

     Before writing the message, carefully read and internalize the complete specification here:  
     https://www.conventionalcommits.org/en/v1.0.0/#specification

     Key guidelines from the spec:
     - Use the format: `<type>[optional scope]: <description>`
     - Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert (and others if justified)
     - Subject line: imperative tense, no capitalization, ≤50 characters
     - Optional body: explain **what** and **why** (not how), wrap at 72 characters
     - Optional footer: for BREAKING CHANGE, references to issues, etc.

     Analyze the project to determine its type (e.g., CLI tool, library, web app, etc.). Distinguish between changes noticeable to end-users (e.g., new features, bug fixes in user-facing behavior) and internal changes (e.g., developer tools, refactors, documentation). Use 'feat' or 'fix' only for changes that are noticeable to the end-user. For internal code changes, enhancements to development workflows, or non-user-facing improvements that benefit developers but not end-users, use types like 'chore', 'refactor', 'docs', or similar.

     Choose the most appropriate type and scope based on the changes. Make the message clear, professional, and informative for future readers (including changelogs and release notes).

   - Commit the staged changes with the crafted message using `git commit -m "<message>"` (include body and footer in the message if needed, using newlines).

6. If multiple commits are needed, perform them sequentially, restaging as necessary after each commit.

7. After all commits, run `git status` again to confirm the repository state and summarize what was committed.

8. If any changes were not committed (e.g., not ready or irrelevant), explain why and suggest next steps.

Prioritize accuracy, completeness, and adherence to the Conventional Commits standard. Make decisions autonomously based on best practices for clean commit history.
