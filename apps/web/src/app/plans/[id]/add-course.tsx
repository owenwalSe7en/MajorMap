"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

interface CourseResult {
  id: string;
  code: string;
  title: string;
  credits: number;
}

interface AddCourseProps {
  excludeCourseIds: string[];
  onSelect: (courseId: string) => void;
  onClose: () => void;
}

export function AddCourse({ excludeCourseIds, onSelect, onClose }: AddCourseProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      const supabase = createClient();

      // Strip PostgREST filter delimiters to prevent injection
      const sanitized = q.replace(/[,().]/g, "");

      try {
        const { data } = await supabase
          .from("courses")
          .select("id, code, title, credits")
          .or(`code.ilike.%${sanitized}%,title.ilike.%${sanitized}%`)
          .limit(20)
          .abortSignal(controller.signal);

        if (!controller.signal.aborted) {
          const filtered = (data ?? []).filter((c) => !excludeCourseIds.includes(c.id));
          setResults(filtered);
        }
      } catch {
        // Aborted or error — ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [excludeCourseIds],
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search courses..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="h-8 text-sm"
      />
      {(results.length > 0 || loading) && (
        <div className="absolute top-full left-0 z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          )}
          {results.map((course) => (
            <button
              key={course.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(course.id)}
            >
              <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
              <span className="ml-2">{course.title}</span>
              <span className="ml-auto text-xs text-muted-foreground"> ({course.credits}cr)</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
