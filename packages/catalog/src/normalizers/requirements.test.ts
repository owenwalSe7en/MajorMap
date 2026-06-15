import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizeRequirements, type RequirementItemDraft } from "./requirements.js";
import { CoursedogProgramSchema, type CoursedogProgram } from "../schemas/coursedog.js";

const FIXTURES = path.resolve(import.meta.dirname, "../../../../data/raw/fixtures");

const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function syntheticProgram(requisitesSimple: unknown[]): CoursedogProgram {
  return CoursedogProgramSchema.parse({
    _id: "p1",
    code: "TESTBS",
    catalogDisplayName: "Test BS",
    requisites: { requisitesSimple },
  });
}

const SYNTHETIC_GROUP = {
  id: "g1",
  name: "Core Requirements",
  requirementLevel: "programRequirements",
  rules: [
    {
      id: "r1",
      condition: "completedAllOf",
      name: "Intro",
      value: {
        condition: "courses",
        values: [
          { value: ["cg-a"], logic: "and" },
          { value: ["cg-b", "cg-c"], logic: "or" },
        ],
      },
    },
    {
      id: "r2",
      condition: "completedAtLeastXOf",
      restriction: 2,
      name: "Electives",
      description: "<p>Pick &amp; choose</p>",
      value: {
        condition: "courses",
        values: [
          { value: ["cg-a"], logic: "and" },
          { value: ["cg-x"], logic: "and" },
          { value: ["cg-c"], logic: "and" },
        ],
      },
    },
    {
      id: "r3",
      condition: "completedAllOf",
      name: "GE Life Sciences",
      value: {
        condition: "courseAttributes",
        values: [{ value: ["GE - LS (Life Sciences)"], logic: "and" }],
      },
    },
  ],
};

function defaultMap(): Map<string, string> {
  return new Map([
    ["cg-a", UUID_A],
    ["cg-b", UUID_B],
    ["cg-c", UUID_C],
  ]);
}

function normalize(overrides?: { map?: Map<string, string>; labels?: Map<string, string> }) {
  const result = normalizeRequirements(syntheticProgram([SYNTHETIC_GROUP]), {
    courseGroupIdMap: overrides?.map ?? defaultMap(),
    courseLabels: overrides?.labels,
  });
  if (!result) throw new Error("expected requirements");
  return result;
}

function childrenOf(items: RequirementItemDraft[], parentId: string | null) {
  return items.filter((i) => i.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}

describe("normalizeRequirements", () => {
  it("returns null when the program has no requirement rules", () => {
    expect(normalizeRequirements(syntheticProgram([]), { courseGroupIdMap: new Map() })).toBeNull();
    expect(
      normalizeRequirements(syntheticProgram([{ id: "g", name: "Empty", rules: [] }]), {
        courseGroupIdMap: new Map(),
      }),
    ).toBeNull();
  });

  it("emits a parents-first topologically ordered flat list", () => {
    const { items } = normalize();
    const seen = new Set<string>();
    for (const item of items) {
      if (item.parent_id !== null) {
        expect(seen.has(item.parent_id)).toBe(true);
      }
      seen.add(item.id);
    }
  });

  it("builds the group tree with resolved course leaves", () => {
    const { items } = normalize();

    const roots = childrenOf(items, null);
    expect(roots).toHaveLength(1);
    expect(roots[0].label).toBe("Core Requirements");
    expect(roots[0].type).toBe("group");

    const ruleNodes = childrenOf(items, roots[0].id);
    expect(ruleNodes.map((r) => r.label)).toEqual(["Intro", "Electives", "GE Life Sciences"]);

    // Intro: one direct course leaf + an or-subgroup with two leaves
    const intro = ruleNodes[0];
    const introChildren = childrenOf(items, intro.id);
    expect(introChildren).toHaveLength(2);
    expect(introChildren[0].type).toBe("course");
    expect(introChildren[0].course_id).toBe(UUID_A);
    expect(introChildren[1].type).toBe("group");
    expect(introChildren[1].courses_required).toBe(1);
    const orLeaves = childrenOf(items, introChildren[1].id);
    expect(orLeaves.map((l) => l.course_id)).toEqual([UUID_B, UUID_C]);
  });

  it("maps completedAtLeastXOf to courses_required and strips description HTML", () => {
    const { items } = normalize();
    const electives = items.find((i) => i.label === "Electives");
    expect(electives?.type).toBe("group");
    expect(electives?.courses_required).toBe(2);
    expect(electives?.credits_required).toBeNull();
    expect(electives?.description).toBe("Pick & choose");
  });

  it("falls back to free_text for unresolvable refs and non-course rules — nothing dropped", () => {
    const { items, stats } = normalize();

    const electives = items.find((i) => i.label === "Electives");
    const electiveChildren = childrenOf(items, electives!.id);
    expect(electiveChildren).toHaveLength(3);
    const freeText = electiveChildren.find((c) => c.type === "free_text");
    expect(freeText).toBeDefined();
    expect(freeText?.course_id).toBeNull();

    const ge = items.find((i) => i.label === "GE Life Sciences");
    expect(ge?.type).toBe("free_text");
    expect(ge?.description).toContain("GE - LS (Life Sciences)");

    expect(stats.leavesResolved).toBe(5);
    expect(stats.leavesFreeText).toBe(2);
  });

  it("labels course leaves from the provided label map", () => {
    const { items } = normalize({
      labels: new Map([[UUID_A, "CS 1400 — Intro to Computer Science"]]),
    });
    const leaf = items.find((i) => i.course_id === UUID_A);
    expect(leaf?.label).toBe("CS 1400 — Intro to Computer Science");
  });

  it("produces a deterministic content hash that tracks resolution changes", () => {
    const first = normalize();
    const second = normalize();
    expect(first.contentHash).toBe(second.contentHash);

    const smallerMap = defaultMap();
    smallerMap.delete("cg-c");
    const third = normalize({ map: smallerMap });
    expect(third.contentHash).not.toBe(first.contentHash);
  });

  it("handles nested anyOf/allOf wrapper rules", () => {
    const program = syntheticProgram([
      {
        id: "g2",
        name: "Tracks",
        rules: [
          {
            id: "w1",
            condition: "anyOf",
            name: "Pick a track",
            subRules: [
              {
                id: "t1",
                condition: "completedAllOf",
                name: "Track A",
                value: { condition: "courses", values: [{ value: ["cg-a"], logic: "and" }] },
              },
              {
                id: "t2",
                condition: "completedAllOf",
                name: "Track B",
                value: { condition: "courses", values: [{ value: ["cg-b"], logic: "and" }] },
              },
            ],
          },
        ],
      },
    ]);
    const result = normalizeRequirements(program, { courseGroupIdMap: defaultMap() });
    expect(result).not.toBeNull();
    const items = result!.items;

    const wrapper = items.find((i) => i.label === "Pick a track");
    expect(wrapper?.type).toBe("group");
    const tracks = childrenOf(items, wrapper!.id);
    expect(tracks.map((t) => t.label)).toEqual(["Track A", "Track B"]);
  });

  it("normalizes the real CPSCBS fixture into a coherent tree", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "coursedog-programs-sample.json"), "utf-8"),
    );
    const programs = (raw.data ?? raw) as unknown[];
    const cpscbs = CoursedogProgramSchema.parse(
      (programs as Array<{ code: string }>).find((p) => p.code === "CPSCBS"),
    );

    const result = normalizeRequirements(cpscbs, {
      courseGroupIdMap: new Map([["0184791", UUID_A]]),
    });
    expect(result).not.toBeNull();
    const { items, stats } = result!;

    expect(items.length).toBeGreaterThan(20);
    expect(stats.leavesResolved).toBeGreaterThan(0);
    expect(stats.leavesFreeText).toBeGreaterThan(0);

    // every item is well-formed
    for (const item of items) {
      expect(["group", "course", "free_text"]).toContain(item.type);
      expect(item.label.length).toBeGreaterThan(0);
      if (item.type === "course") expect(item.course_id).not.toBeNull();
      if (item.type !== "course") expect(item.course_id).toBeNull();
    }
  });
});
