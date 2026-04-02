export interface RequirementItem {
  id: string;
  requirement_set_id: string;
  parent_id: string | null;
  sort_order: number;
  label: string;
  type: string;
  course_id: string | null;
  credits_required: number | null;
  courses_required: number | null;
  description: string | null;
  raw_rule: unknown;
}

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
