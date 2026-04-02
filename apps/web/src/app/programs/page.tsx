import { createClient } from "@/lib/supabase/server";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "next/link";

export const metadata = { title: "Programs" };

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function ProgramsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("programs")
    .select("id, slug, name, degree_type, total_credits, description")
    .order("name");

  if (params.q) {
    query = query.ilike("name", `%${params.q}%`);
  }
  if (params.type) {
    query = query.eq("degree_type", params.type);
  }

  const { data: programs } = await query.limit(100);

  return (
    <>
      <Typography variant="h1" gutterBottom>
        Programs
      </Typography>

      <Box component="form" method="get" sx={{ display: "flex", gap: 2, mb: 4 }}>
        <input
          name="q"
          placeholder="Search programs..."
          defaultValue={params.q ?? ""}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            fontSize: 16,
          }}
        />
        <select
          name="type"
          defaultValue={params.type ?? ""}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E5E5" }}
        >
          <option value="">All Types</option>
          <option value="Bachelor of Science">BS</option>
          <option value="Bachelor of Arts">BA</option>
          <option value="Minor">Minor</option>
          <option value="Graduate Certificate">Certificate</option>
          <option value="Master of Science">MS</option>
          <option value="Doctor of Philosophy">PhD</option>
        </select>
        <button
          type="submit"
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: "#CC0000",
            color: "white",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Search
        </button>
      </Box>

      <Grid container spacing={2}>
        {programs?.map((program) => (
          <Grid item xs={12} sm={6} md={4} key={program.id}>
            <Card>
              <CardActionArea component={Link} href={`/programs/${program.slug}`}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {program.name}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Chip label={program.degree_type} size="small" />
                    {program.total_credits && (
                      <Typography variant="body2" color="text.secondary">
                        {program.total_credits} credits
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {(!programs || programs.length === 0) && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No programs found. Try a different search.
        </Typography>
      )}
    </>
  );
}
