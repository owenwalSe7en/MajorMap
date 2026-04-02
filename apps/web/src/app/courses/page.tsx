import { createClient } from "@/lib/supabase/server";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Link from "next/link";

export const metadata = { title: "Courses" };

interface Props {
  searchParams: Promise<{ q?: string; dept?: string }>;
}

export default async function CoursesPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("courses")
    .select("id, subject_code, number, title, credits_min, credits_max")
    .order("subject_code")
    .order("number");

  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }
  if (params.dept) {
    query = query.eq("subject_code", params.dept);
  }

  const { data: courses } = await query.limit(50);

  return (
    <>
      <Typography variant="h1" gutterBottom>
        Courses
      </Typography>

      <Box component="form" method="get" sx={{ display: "flex", gap: 2, mb: 4 }}>
        <input
          name="q"
          placeholder="Search by title..."
          defaultValue={params.q ?? ""}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            fontSize: 16,
          }}
        />
        <input
          name="dept"
          placeholder="Subject (e.g. CS)"
          defaultValue={params.dept ?? ""}
          style={{
            width: 140,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            fontSize: 16,
          }}
        />
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Title</TableCell>
              <TableCell align="right">Credits</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {courses?.map((course) => (
              <TableRow key={course.id} hover>
                <TableCell>
                  <Link
                    href={`/courses/${course.subject_code}-${course.number}`}
                    style={{ color: "#CC0000", textDecoration: "none" }}
                  >
                    {course.subject_code} {course.number}
                  </Link>
                </TableCell>
                <TableCell>{course.title}</TableCell>
                <TableCell align="right">
                  {course.credits_min === course.credits_max
                    ? course.credits_min
                    : `${course.credits_min}-${course.credits_max}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {(!courses || courses.length === 0) && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No courses found. Try a different search.
        </Typography>
      )}
    </>
  );
}
