import Link from "next/link";

export function FooterSection() {
  return (
    <footer className="border-t border-foreground/10 py-12">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Major Map — Free and open source degree planning.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/programs" className="hover:text-foreground transition-colors">
              Programs
            </Link>
            <Link href="/courses" className="hover:text-foreground transition-colors">
              Courses
            </Link>
            <a
              href="https://github.com/owenwalSe7en/MajorMap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
