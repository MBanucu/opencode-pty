{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

let
  browsers =
    (builtins.fromJSON (builtins.readFile "${pkgs.playwright-driver}/browsers.json")).browsers;
  chromium-rev = (builtins.head (builtins.filter (x: x.name == "chromium") browsers)).revision;
  firefox-rev = (builtins.head (builtins.filter (x: x.name == "firefox") browsers)).revision;
in
{
  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    bashInteractive
    biome
    playwright-driver.browsers
  ];

  env = with pkgs; {
    PLAYWRIGHT_BROWSERS_PATH = "${playwright-driver.browsers}";
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${playwright-driver.browsers}/chromium-${chromium-rev}/chrome-linux64/chrome";
    PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH = "${playwright-driver.browsers}/firefox-${firefox-rev}/firefox/firefox";
  };

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
