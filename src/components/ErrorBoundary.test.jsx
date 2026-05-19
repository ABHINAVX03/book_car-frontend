import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Thrower() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders a fallback UI when a child crashes", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary resetKey="/profile">
        <Thrower />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
