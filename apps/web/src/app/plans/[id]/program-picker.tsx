"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GraduationCap } from "lucide-react";
import { setPlanProgram } from "../actions";

interface ProgramOption {
  id: string;
  name: string;
  degree_type: string;
}

interface ProgramPickerProps {
  planId: string;
  currentProgram: { id: string; name: string } | null;
  /** Scopes the search to the plan's school. */
  universityId?: string | null;
}

export function ProgramPicker({ planId, currentProgram, universityId }: ProgramPickerProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProgramOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!editing || !query.trim() || query.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const supabase = createClient();

      let search = supabase
        .from("programs")
        .select("id, name, degree_type")
        .eq("is_discontinued", false)
        .ilike("name", `%${query.replace(/[%_]/g, "")}%`);
      if (universityId) search = search.eq("university_id", universityId);

      search
        .order("name")
        .limit(10)
        .abortSignal(controller.signal)
        .then(({ data, error: searchFailure }) => {
          if (controller.signal.aborted) return;
          if (searchFailure) {
            setResults([]);
            setSearchError("Search failed — try again");
            return;
          }
          setSearchError(null);
          setResults((data ?? []) as ProgramOption[]);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, query, universityId]);

  function apply(programId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setPlanProgram(planId, programId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setQuery("");
      router.refresh();
    });
  }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Program</h3>
      </div>

      {!editing && currentProgram && (
        <div className="space-y-2">
          <p className="text-sm">{currentProgram.name}</p>
          <div className="flex gap-3">
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
              disabled={isPending}
            >
              Change
            </button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => apply(null)}
              disabled={isPending}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {!editing && !currentProgram && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Pick a program to track requirements and get course suggestions.
          </p>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setEditing(true)}
            disabled={isPending}
          >
            Select a program
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Search programs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-sm"
            aria-label="Search programs"
          />
          {results.length > 0 && (
            <div className="rounded-md border max-h-48 overflow-y-auto">
              {results.map((program) => (
                <button
                  key={program.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  onClick={() => apply(program.id)}
                  disabled={isPending}
                >
                  <span className="font-medium">{program.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{program.degree_type}</span>
                </button>
              ))}
            </div>
          )}
          {searchError && <p className="text-xs text-destructive">{searchError}</p>}
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditing(false);
              setQuery("");
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </Card>
  );
}
