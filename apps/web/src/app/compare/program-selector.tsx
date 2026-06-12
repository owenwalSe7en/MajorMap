"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { UTAH_UNIVERSITY_ID } from "@major-map/shared";

interface Program {
  id: string;
  name: string;
  degree_type: string;
  total_credits: number | null;
}

interface ProgramSelectorProps {
  label: string;
  selectedId: string | null;
  onSelect: (program: Program | null) => void;
  excludeId?: string | null;
}

export function ProgramSelector({ label, onSelect, excludeId }: ProgramSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Program[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const supabase = createClient();

    // Compare is single-school for now — scope to the default school so a
    // second seeded catalog can't interleave results.
    supabase
      .from("programs")
      .select("id, name, degree_type, total_credits")
      .eq("university_id", UTAH_UNIVERSITY_ID)
      .ilike("name", `%${query}%`)
      .limit(10)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const filtered = (data ?? []).filter((p) => p.id !== excludeId) as Program[];
        setResults(filtered);
        setIsOpen(true);
      });

    return () => controller.abort();
  }, [query, excludeId]);

  function handleSelect(program: Program) {
    setSelectedName(program.name);
    setQuery("");
    setIsOpen(false);
    onSelect(program);
  }

  function handleClear() {
    setSelectedName(null);
    setQuery("");
    onSelect(null);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {selectedName ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="truncate">{selectedName}</span>
          <button onClick={handleClear} className="ml-2 text-xs text-muted-foreground hover:text-foreground">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder="Search programs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-sm"
          />
          {isOpen && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
              {results.map((program) => (
                <button
                  key={program.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleSelect(program)}
                >
                  <span className="font-medium">{program.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{program.degree_type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
