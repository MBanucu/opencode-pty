---
description: Analyzes recent git commits, determines version bump, and updates CHANGELOG.md following Keep a Changelog and Semantic Versioning guidelines.
subtask: true
---

Follow these steps to update the CHANGELOG.md file based on recent changes in the git history.

First, review the key guidelines from Keep a Changelog (https://keepachangelog.com/en/1.0.0/):

- Use CHANGELOG.md as the file name.
- Follow reverse chronological order with the latest version first.
- Each version entry: [version] followed by ISO 8601 date (YYYY-MM-DD).
- Include an [Unreleased] section at the top for upcoming changes.
- Sections: Added (new features), Changed (existing functionality), Deprecated, Removed, Fixed (bugs), Security (vulnerabilities).
- Best practices: Adhere to Semantic Versioning; keep human-readable; include release dates; make linkable; avoid empty sections; mark yanked releases.

Next, review Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html):

- Version format: MAJOR.MINOR.PATCH (e.g., 1.2.3).
- Pre-release: Append -alpha.1 etc.; build metadata: +001 (ignored in precedence).
- Increment: MAJOR for incompatible API changes; MINOR for backward-compatible additions/deprecations; PATCH for backward-compatible bug fixes.
- Version 0.y.z for unstable initial development.
- Precedence: Compare MAJOR/MINOR/PATCH numerically; pre-releases lower than normal; compare pre-release identifiers lexically/numerically.

Now, analyze the project:

1. Get the current CHANGELOG.md content: @CHANGELOG.md

2. Identify the last released version from CHANGELOG.md or git tags: !git describe --tags --abbrev=0 || echo "0.0.0"

Let last_version = output of above.

3. Get commit messages since last version: !git log --pretty=format:"%s" ${last_version}..HEAD

If no commits, respond: "No changes since last version. No update needed."

4. Classify each commit message into categories (Added, Changed, Deprecated, Removed, Fixed, Security). Use conventional commit prefixes if present (feat: → Added, fix: → Fixed, breaking: → Changed with MAJOR bump).

5. Determine version bump:
   - MAJOR if any breaking changes.
   - MINOR if new features (Added) but no breaking.
   - PATCH if only fixes/changes without new features or breaking.
   - If pre-release needed, append -alpha.1 etc. (decide based on stability).

Compute next_version by incrementing from last_version accordingly.

6. Group changes under appropriate headings. Omit empty sections.

7. Get today's date: !date +%Y-%m-%d

8. Decide on release strategy:
   - For unreleased changes: Add or update the [Unreleased] section at the top.
   - For a new release: Create new section ## [next_version] - today's_date

Add the grouped changes to the appropriate section.

If [Unreleased] exists, incorporate or replace it.

9. Preserve existing CHANGELOG content, inserting the new section after the header or updating [Unreleased] as appropriate.

10. Output the full updated CHANGELOG.md content.

If $ARGUMENTS provided, use it as additional changes or override (e.g., /update-changelog "Added: new feature").

Ensure the update is accurate, concise, and follows the guidelines exactly.
