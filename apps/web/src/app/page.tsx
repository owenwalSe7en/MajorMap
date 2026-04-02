import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";

export default function HomePage() {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <Typography variant="h1" gutterBottom>
        Plan your degree, your way.
      </Typography>
      <Typography variant="h5" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
        Browse University of Utah programs, explore course requirements, and build your semester
        plan.
      </Typography>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <Button variant="contained" component={Link} href="/programs" size="large">
          Explore Programs
        </Button>
        <Button variant="outlined" component={Link} href="/courses" size="large">
          Search Courses
        </Button>
      </Box>
    </Box>
  );
}
