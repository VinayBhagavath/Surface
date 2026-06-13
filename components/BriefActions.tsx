"use client";

import { Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BriefActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          navigator.clipboard
            ?.writeText(window.location.href)
            .then(() => toast.success("Link copied to clipboard"))
            .catch(() => toast.error("Couldn't copy the link"));
        }}
      >
        <Link2 className="size-4" /> Copy link
      </Button>
      <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
        <Printer className="size-4" /> Print / Save PDF
      </Button>
    </div>
  );
}
