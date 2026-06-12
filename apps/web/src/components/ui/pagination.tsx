import Link from "next/link";
import { pageHref, pageNumbers, showingRange } from "@/lib/browse";

interface PaginationProps {
  basePath: string;
  page: number;
  lastPage: number;
  params: Record<string, string | undefined>;
  totalCount: number;
  pageSize: number;
}

export function Pagination({
  basePath,
  page,
  lastPage,
  params,
  totalCount,
  pageSize,
}: PaginationProps) {
  const { start, end } = showingRange(page, pageSize, totalCount);
  const items = pageNumbers(page, lastPage);

  return (
    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {totalCount === 0
          ? "No results"
          : `Showing ${start}–${end} of ${totalCount.toLocaleString("en-US")} results`}
      </p>

      <nav aria-label="Pagination">
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link
                href={pageHref(basePath, params, page - 1)}
                rel="prev"
                aria-label="Previous page"
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Previous
              </Link>
            ) : (
              <span aria-disabled="true" className="px-3 py-2 text-sm text-muted-foreground/50">
                Previous
              </span>
            )}
          </li>

          {items.map((item, i) =>
            item === "ellipsis" ? (
              <li key={`e-${i}`}>
                <span aria-hidden="true" className="px-2 text-sm text-muted-foreground">
                  …
                </span>
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={pageHref(basePath, params, item)}
                  aria-label={`Page ${item}`}
                  {...(item === page && { "aria-current": "page" as const })}
                  className={
                    item === page
                      ? "px-3 py-2 text-sm rounded-md bg-foreground text-background font-medium"
                      : "px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  }
                >
                  {item}
                </Link>
              </li>
            ),
          )}

          <li>
            {page < lastPage ? (
              <Link
                href={pageHref(basePath, params, page + 1)}
                rel="next"
                aria-label="Next page"
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Next
              </Link>
            ) : (
              <span aria-disabled="true" className="px-3 py-2 text-sm text-muted-foreground/50">
                Next
              </span>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
}
