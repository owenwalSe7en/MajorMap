import { createClient } from "@/lib/supabase/server";
import { buildRequirementTree, type RequirementNode } from "@/lib/requirements-tree";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("name, degree_type")
    .eq("slug", slug)
    .single();

  if (!program) return { title: "Program Not Found" };
  return { title: `${program.name} ${program.degree_type}` };
}

function RequirementTreeView({ nodes, depth = 0 }: { nodes: RequirementNode[]; depth?: number }) {
  return (
    <List dense sx={{ pl: depth * 2 }}>
      {nodes.map((node) => (
        <Box key={node.id}>
          <ListItem>
            <ListItemText
              primary={node.label}
              secondary={
                node.type === "course" && node.course_id
                  ? `Course`
                  : node.credits_required
                    ? `${node.credits_required} credits required`
                    : node.courses_required
                      ? `${node.courses_required} courses required`
                      : undefined
              }
            />
            {node.type !== "group" && <Chip label={node.type} size="small" variant="outlined" />}
          </ListItem>
          {node.children.length > 0 && (
            <RequirementTreeView nodes={node.children} depth={depth + 1} />
          )}
        </Box>
      ))}
    </List>
  );
}

export default async function ProgramDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: program } = await supabase.from("programs").select("*").eq("slug", slug).single();

  if (!program) notFound();

  // Get active requirement set
  const { data: reqSet } = await supabase
    .from("requirement_sets")
    .select("id, version_label")
    .eq("program_id", program.id)
    .eq("is_active", true)
    .single();

  let requirementTree: RequirementNode[] = [];
  if (reqSet) {
    const { data: items } = await supabase
      .from("requirement_items")
      .select("*")
      .eq("requirement_set_id", reqSet.id)
      .order("sort_order");

    if (items) {
      requirementTree = buildRequirementTree(items);
    }
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          {program.name}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
          <Chip label={program.degree_type} color="primary" />
          {program.total_credits && (
            <Typography variant="body1" color="text.secondary">
              {program.total_credits} total credits
            </Typography>
          )}
        </Box>
        {program.description && (
          <Typography
            variant="body1"
            color="text.secondary"
            dangerouslySetInnerHTML={{ __html: program.description }}
          />
        )}
      </Box>

      {reqSet && (
        <Box>
          <Typography variant="h2" gutterBottom>
            Requirements ({reqSet.version_label})
          </Typography>
          {requirementTree.length > 0 ? (
            <RequirementTreeView nodes={requirementTree} />
          ) : (
            <Typography color="text.secondary">
              No detailed requirements available for this program yet.
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}
