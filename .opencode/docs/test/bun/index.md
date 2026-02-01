# Unit Testing Guide for Coding Agents

This document provides comprehensive instructions for running and working with unit tests using Bun's fast, built-in, Jest-compatible test runner.

## Contents

- **[Unit Tests: Basics](unit-tests-basics.md)** - Running tests, file discovery, test structure, and basic usage
- **[Unit Tests: Advanced Features](unit-tests-advanced.md)** - Concurrent execution, test modifiers, parametrized tests, lifecycle hooks, mocking, and snapshots
- **[Unit Tests: Workflow and Integration](unit-tests-workflow.md)** - Common tasks, CI/CD integration, troubleshooting, and quick reference

## Quick Start

```bash
bun test                    # Run all unit tests
bun test --watch           # Watch mode for development
bun test -t "pattern"      # Run tests matching pattern
bun test --coverage        # Generate coverage report
```

## Overview

Bun's test runner provides Jest-compatible API with native performance. It automatically discovers test files and supports modern testing patterns including concurrent execution, mocking, and snapshot testing.

Tests run in Bun's JavaScript runtime, providing fast execution without browser dependencies. The runner includes AI agent optimization that reduces output noise during development.

---

_For complete Bun test documentation, visit: https://bun.com/docs/test_
