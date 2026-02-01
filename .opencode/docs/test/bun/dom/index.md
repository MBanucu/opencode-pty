---
title: Bun DOM Testing Guide
description: Comprehensive guide for testing DOM elements and components using Bun with happy-dom and React Testing Library
---

# DOM Testing Guide for Bun

This document provides comprehensive instructions for testing DOM elements, components, and browser APIs using Bun's test runner with happy-dom and React Testing Library.

## Contents

- **[DOM Testing: Setup and Basics](dom-testing-setup.md)** - Installation, setup, basic usage examples
- **[DOM Testing: React Testing Library Integration](dom-testing-react.md)** - React component testing with React Testing Library
- **[DOM Testing: Advanced Features and APIs](dom-testing-advanced.md)** - APIs, patterns, configuration, troubleshooting

## Quick Start

```bash
bun add -d @happy-dom/global-registrator  # Install happy-dom
# Create happydom.ts preload file
bun test                                   # Run DOM tests
```

## Overview

Bun's DOM testing provides fast, headless browser simulation for unit testing UI components and DOM manipulation logic. It integrates seamlessly with React Testing Library for component testing and supports modern testing patterns including concurrent execution and snapshot testing.

---

_For complete Bun documentation, visit: https://bun.com/docs_

_For happy-dom documentation, visit: https://github.com/capricorn86/happy-dom_
