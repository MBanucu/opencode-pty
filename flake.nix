{
  description = "Bun devShell with bun2nix JS dependencies";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.bun2nix.url = "github:nix-community/bun2nix";

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      bun2nix,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        bunDeps = bun2nix.packages.${system}.bun2nix.fetchBunDeps {
          bunNix = ./nix/bun.nix;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.bun
            bunDeps
            pkgs.bashInteractive
          ];
          shellHook = ''
            echo "Bun devShell loaded with bun2nix deps. Re-run bun2nix after dependency changes!"
          '';
        };
      }
    );

}
