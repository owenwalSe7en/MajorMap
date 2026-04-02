import { createClient } from "@/lib/supabase/server";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const [subjectCode, number] = code.split("-");
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, subject_code, number")
    .eq("subject_code", subjectCode)
    .eq("number", number)
    .single();

  if (!course) return { title: "Course Not Found" };
  return { title: `${course.subject_code} ${course.number} — ${course.title}` };
}

export default async function CourseDetailPage({ params }: Props) {
  const { code } = await params;
  const [subjectCode, number] = code.split("-");
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("subject_code", subjectCode)
    .eq("number", number)
    .single();

  if (!course) notFound();

  // Get prerequisites
  const { data: prereqs } = await supabase
    .from("course_prerequisites")
    .select(
      "prerequisite_course_id, group_operator, condition, min_grade, is_corequisite, description_override",
    )
    .eq("course_id", course.id);

  // Resolve prerequisite course names
  let prereqCourses: { id: string; subject_code: string; number: string; title: string }[] = [];
  if (prereqs && prereqs.length > 0) {
    const prereqIds = prereqs
      .map((p) => p.prerequisite_course_id)
      .filter((id): id is string => id !== null);

    if (prereqIds.length > 0) {
      const { data } = await supabase
        .from("courses")
        .select("id, subject_code, number, title")
        .in("id", prereqIds);
      prereqCourses = data ?? [];
    }
  }

  const credits =
    course.credits_min === course.credits_max
      ? `${course.credits_min}`
      : `${course.credits_min}-${course.credits_max}`;

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          {course.subject_code} {course.number}
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          {course.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Chip label={`${credits} credits`} color="primary" />
          {course.typically_offered?.length > 0 &&
            course.typically_offered.map((term: string) => (
              <Chip key={term} label={term} variant="outlined" size="small" />
            ))}
        </Box>
      </Box>

      {course.description && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h3" gutterBottom>
            Description
          </Typography>
          <Typography variant="body1">{course.description}</Typography>
        </Paper>
      )}

      {prereqs && prereqs.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h3" gutterBottom>
            Prerequisites
          </Typography>
          <List dense>
            {prereqCourses.map((pc) => (
              <ListItem key={pc.id}>
                <ListItemText>
                  <Link
                    href={`/courses/${pc.subject_code}-${pc.number}`}
                    style={{ color: "#CC0000", textDecoration: "none" }}
                  >
                    {pc.subject_code} {pc.number}
                  </Link>
                  {" — "}
                  {pc.title}
                </ListItemText>
              </ListItem>
            ))}
            {prereqs
              .filter((p) => p.description_override)
              .map((p, i) => (
                <ListItem key={`override-${i}`}>
                  <ListItemText secondary={p.description_override} />
                </ListItem>
              ))}
          </List>
        </Paper>
      )}
    </>
  );
}
