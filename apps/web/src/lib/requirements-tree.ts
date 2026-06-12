import type { RequirementItemRow } from "@major-map/shared";

// Canonical row shape lives in @major-map/shared (written by the catalog
// pipeline); `type` is widened because legacy rows may carry other strings.
export type RequirementItem = Omit<RequirementItemRow, "type"> & { type: string };

export interface RequirementNode extends RequirementItem {
  children: RequirementNode[];
}

export function buildRequirementTree(items: RequirementItem[]): RequirementNode[] {
  const nodeMap = new Map<string, RequirementNode>();
  const roots: RequirementNode[] = [];

  // Create nodes with empty children
  for (const item of items) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

  // Build tree by linking children to parents
  for (const node of nodeMap.values()) {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // orphan → treat as root
      }
    }
  }

  // Sort children by sort_order
  const sortChildren = (node: RequirementNode): void => {
    node.children.sort((a, b) => a.sort_order - b.sort_order);
    for (const child of node.children) sortChildren(child);
  };
  for (const root of roots) sortChildren(root);

  roots.sort((a, b) => a.sort_order - b.sort_order);
  return roots;
}
