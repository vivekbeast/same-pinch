// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BP } from "./breakpoints";

describe("breakpoints", () => {
  it("match theme.css (the single source of truth)", () => {
    const css = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");
    for (const [name, px] of Object.entries(BP)) {
      const m = css.match(new RegExp(String.raw`--breakpoint-${name}:\s*([\d.]+)rem`));
      expect(m, `--breakpoint-${name} missing`).not.toBeNull();
      expect(Number(m![1]) * 16).toBe(px);
    }
  });
});
