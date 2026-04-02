import type { ReactNode } from "react";
import { ThemeRegistry } from "@/components/ThemeRegistry";
import { AppNav } from "@/components/AppNav";
import Container from "@mui/material/Container";

export const metadata = {
  title: {
    default: "Major Map",
    template: "%s | Major Map",
  },
  description: "Plan your degree, your way. Browse programs, plan semesters, and track progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <AppNav />
          <Container maxWidth="lg" sx={{ py: 4 }}>
            {children}
          </Container>
        </ThemeRegistry>
      </body>
    </html>
  );
}
