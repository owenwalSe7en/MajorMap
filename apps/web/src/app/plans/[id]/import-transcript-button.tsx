"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import { TranscriptImportModal } from "./transcript-import-modal";

export function ImportTranscriptButton({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp className="mr-2 h-4 w-4" />
        Import Transcript
      </Button>
      <TranscriptImportModal planId={planId} open={open} onOpenChange={setOpen} />
    </>
  );
}
