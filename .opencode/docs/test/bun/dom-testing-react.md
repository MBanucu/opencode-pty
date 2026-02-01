# DOM Testing: React Testing Library Integration

This document covers testing React components using React Testing Library with Bun and happy-dom.

## React Testing Library Integration

For React components, Bun works seamlessly with React Testing Library.

### Installation

```bash
bun add -d @testing-library/react @testing-library/jest-dom
```

### Testing React Components

```typescript
/// <reference lib="dom" />

import { test, expect, describe } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React, { useState } from "react";

// Example component
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}

describe("Counter Component", () => {
  test("renders with initial count of 0", () => {
    render(<Counter />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  test("increments count when button is clicked", () => {
    render(<Counter />);
    const button = screen.getByRole("button", { name: /increment/i });

    fireEvent.click(button);

    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  test("increments multiple times", () => {
    render(<Counter />);
    const button = screen.getByRole("button", { name: /increment/i });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.getByTestId("count")).toHaveTextContent("3");
  });
});
```

### Async Component Testing

```typescript
/// <reference lib="dom" />

import { test, expect } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React, { useEffect, useState } from "react";

function AsyncComponent() {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => setData("loaded"), 100);
  }, []);

  return <div>{data ? data : "loading..."}</div>;
}

test("async component displays data after loading", async () => {
  render(<AsyncComponent />);

  expect(screen.getByText("loading...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("loaded")).toBeInTheDocument();
  });
});
```
