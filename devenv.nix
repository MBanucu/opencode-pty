{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # https://devenv.sh/packages/
  packages = [
    pkgs.git
    pkgs.bashInteractive
    pkgs.biome
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    # disable prepending node_modules/.bin to PATH
    # it is causing trouble with biome
    enable = true;
    bun = {
      enable = true;
      install = {
        enable = true;
      };
    };
  };

  # https://devenv.sh/scripts/
  scripts = {
    hello.exec = ''
      echo hello from $GREET
    '';
    typecheck.exec = "bun typecheck";
    "test:e2e".exec = "bun test:e2e";
    "test:all".exec = "bun test:all";
    "build:dev".exec = "bun build:dev";
    "build:prod".exec = "bun build:prod";
    clean.exec = "bun clean";
    lint.exec = "biome lint .";
    "lint:fix".exec = "biome lint --write .";
    format.exec = "biome format .";
    "format:fix".exec = "biome format --write .";
  };

  # Remove node_modules/.bin from PATH
  enterShell = ''
    PATH=$(echo "$PATH" | tr ':' '\n' | grep -v '^node_modules/.bin$' | tr '\n' ':' | sed 's/:$//')
  '';

  # See full reference at https://devenv.sh/reference/options/
}
