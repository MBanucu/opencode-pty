# Bun2Nix-powered devShell with flakes

This project includes a reproducible Nix flake setup for Bun projects, including JS dependencies via bun2nix.

## Usage

1. Make sure `bun.lock` exists. If not, run:
   ```sh
   bun install
   ```
2. Generate/update Bun dependencies for Nix:

   ```sh
   nix run github:nix-community/bun2nix -- -o nix/bun.nix
   ```

   Or install bun2nix locally and run:

   ```sh
   bun2nix -o nix/bun.nix
   ```

   **Note**: If you see a warning about unlocked dependencies (like `"@types/bun": "latest"`), fix your `package.json` by pinning to specific versions before regenerating.

3. Enter your dev shell:
   ```sh
   nix develop
   ```
   This will load Bun and your JS deps. Re-run step 2 whenever `bun.lock` or `package.json` changes.

## Files included

- `flake.nix`: Nix flake for devShell with Bun and JS deps
- `nix/bun.nix`: Bun JS dependencies (generated from bun2nix)

## Notes

- This setup provides reproducible builds and offline dependency fetching
- Add more Nix dev tools to `packages` in `flake.nix` as needed
- Automated bun2nix regeneration can be scripted in CI/CD
- For more info, see: https://github.com/nix-community/bun2nix
