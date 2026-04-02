import { describe, expect, it } from "vitest";

describe("buildRequirementTree", () => {
  it("builds a tree from flat requirement items", async () => {
    const { buildRequirementTree } = await import("./requirements-tree.js");

    const items = [
      { id: "root", requirement_set_id: "rs1", parent_id: null, sort_order: 0, label: "Core", type: "group", course_id: null, credits_required: null, courses_required: null, description: null, raw_rule: null },
      { id: "child1", requirement_set_id: "rs1", parent_id: "root", sort_order: 0, label: "CS 1400", type: "course", course_id: "c1", credits_required: null, courses_required: null, description: null, raw_rule: null },
      { id: "child2", requirement_set_id: "rs1", parent_id: "root", sort_order: 1, label: "CS 1410", type: "course", course_id: "c2", credits_required: null, courses_required: null, description: null, raw_rule: null },
    ];

    const tree = buildRequirementTree(items);
    expect(tree).toHaveLength(1); // one root node
    expect(tree[0].label).toBe("Core");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].label).toBe("CS 1400");
  });

  it("returns empty array for empty input", async () => {
    const { buildRequirementTree } = await import("./requirements-tree.js");
    const tree = buildRequirementTree([]);
    expect(tree).toHaveLength(0);
  });

  it("sorts children by sort_order", async () => {
    const { buildRequirementTree } = await import("./requirements-tree.js");

    const items = [
      { id: "root", requirement_set_id: "rs1", parent_id: null, sort_order: 0, label: "Core", type: "group", course_id: null, credits_required: null, courses_required: null, description: null, raw_rule: null },
      { id: "b", requirement_set_id: "rs1", parent_id: "root", sort_order: 2, label: "Second", type: "course", course_id: "c2", credits_required: null, courses_required: null, description: null, raw_rule: null },
      { id: "a", requirement_set_id: "rs1", parent_id: "root", sort_order: 1, label: "First", type: "course", course_id: "c1", credits_required: null, courses_required: null, description: null, raw_rule: null },
    ];

    const tree = buildRequirementTree(items);
    expect(tree[0].children[0].label).toBe("First");
    expect(tree[0].children[1].label).toBe("Second");
  });
});
