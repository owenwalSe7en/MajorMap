import { createClient } from "@/lib/supabase/server";
import { buildRequirementTree, type RequirementNode } from "@/lib/requirements-tree";
import { Badge } from "@/components/ui/badge";
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

function RequirementTree({ nodes, depth = 0 }: { nodes: RequirementNode[]; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-6 border-l border-foreground/10 pl-4" : ""}>
      {nodes.map((node) => (
        <div key={node.id} className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            {node.type === "group" ? (
              <span className="font-semibold text-foreground">{node.label}</span>
            ) : node.type === "free_text" ? (
              <span className="text-muted-foreground italic">{node.label}</span>
            ) : (
              <span className="text-muted-foreground">{node.label}</span>
            )}
            {node.type === "free_text" && (
              <Badge variant="outline" className="text-xs">
                see catalog
              </Badge>
            )}
            {node.courses_required != null && (
              <span className="text-xs text-muted-foreground">
                (choose {node.courses_required})
              </span>
            )}
            {node.credits_required != null && (
              <span className="text-xs text-muted-foreground">
                ({node.credits_required} cr required)
              </span>
            )}
          </div>
          {node.description && (
            <p className="mt-1 text-xs text-muted-foreground/80 max-w-2xl">{node.description}</p>
          )}
          {node.children.length > 0 && <RequirementTree nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

export default async function ProgramDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: program } = await supabase.from("programs").select("*").eq("slug", slug).single();
  if (!program) notFound();

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
    if (items) requirementTree = buildRequirementTree(items);
  }

  return (
    <main className="min-h-screen noise-overlay">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-8 pb-16">
        <div className="mb-12">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Program Detail
          </span>
          <h1 className="text-4xl lg:text-6xl font-display tracking-tight mb-4">{program.name}</h1>
          <div className="flex items-center gap-3">
            <Badge>{program.degree_type}</Badge>
            {program.total_credits && (
              <span className="text-muted-foreground">{program.total_credits} total credits</span>
            )}
          </div>
        </div>

        {program.description && (
          <div className="mb-12 max-w-3xl">
            <p className="text-lg text-muted-foreground leading-relaxed">
              {program.description.replace(/<[^>]*>/g, "")}
            </p>
          </div>
        )}

        {reqSet && (
          <div>
            <h2 className="text-2xl font-display mb-6">
              Requirements
              <span className="text-muted-foreground text-lg ml-2">({reqSet.version_label})</span>
            </h2>
            {requirementTree.length > 0 ? (
              <div className="border border-foreground/10 rounded-xl p-6">
                <RequirementTree nodes={requirementTree} />
              </div>
            ) : (
              <p className="text-muted-foreground">
                No detailed requirements available for this program yet.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
