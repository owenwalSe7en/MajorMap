import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "./pagination.js";

describe("Pagination", () => {
  it("renders an accessible nav with current page marked", () => {
    render(
      <Pagination
        basePath="/programs"
        page={2}
        lastPage={5}
        params={{ q: "bio" }}
        totalCount={120}
        pageSize={24}
      />,
    );

    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav).toBeInTheDocument();

    const current = screen.getByRole("link", { name: "Page 2" });
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("links preserve filters and omit page=1", () => {
    render(
      <Pagination
        basePath="/programs"
        page={2}
        lastPage={5}
        params={{ q: "bio" }}
        totalCount={120}
        pageSize={24}
      />,
    );

    expect(screen.getByRole("link", { name: "Page 1" })).toHaveAttribute("href", "/programs?q=bio");
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/programs?q=bio&page=3",
    );
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("rel", "prev");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("rel", "next");
  });

  it("disables prev on the first page and next on the last as non-links", () => {
    render(
      <Pagination
        basePath="/courses"
        page={1}
        lastPage={1}
        params={{}}
        totalCount={10}
        pageSize={50}
      />,
    );

    expect(screen.queryByRole("link", { name: /previous/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /next/i })).toBeNull();
    expect(screen.getByText("Previous")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the result range", () => {
    render(
      <Pagination
        basePath="/courses"
        page={3}
        lastPage={3}
        params={{}}
        totalCount={120}
        pageSize={50}
      />,
    );

    expect(screen.getByText(/showing 101–120 of 120/i)).toBeInTheDocument();
  });

  it("renders nothing extra when there is a single page but still shows counts", () => {
    render(
      <Pagination
        basePath="/courses"
        page={1}
        lastPage={1}
        params={{}}
        totalCount={5}
        pageSize={50}
      />,
    );

    expect(screen.getByText(/showing 1–5 of 5/i)).toBeInTheDocument();
  });
});
