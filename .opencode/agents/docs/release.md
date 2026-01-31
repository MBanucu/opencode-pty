# Release

## Automated Release

- Releases triggered by version bumps to main branch
- Use `./release.sh` script for version management:
  ```sh
  ./release.sh --patch  # Patch version bump
  ./release.sh --minor  # Minor version bump
  ./release.sh --major  # Major version bump
  ./release.sh --dry-run  # Preview changes
  ```

## Release Workflow

1. **Version Bump**: Script updates `package.json` version
2. **Git Tag**: Creates `v{X.Y.Z}` tag on main branch
3. **GitHub Actions**: Triggers release workflow
4. **NPM Publish**: Automated publishing with provenance
5. **Changelog**: Generated from git commit history

## Pre-release Checks

- All tests pass (`bun run ci`)
- Build succeeds (`bun run build`)
- No uncommitted changes
- Git working directory clean

## Post-release

- Version available on NPM within minutes
- OpenCode plugin updates automatically
- GitHub release created with changelog
