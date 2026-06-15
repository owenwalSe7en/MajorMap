import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL only auto-cleans when a global afterEach exists; vitest globals are off
// in this repo, so unmount rendered trees between tests explicitly.
afterEach(cleanup);
