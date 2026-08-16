"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Opens the browser's print dialogue.
 *
 * Workers have no headless browser, so there is no server-side PDF step — the
 * pack is a print-styled page and "Save as PDF" in the print dialogue is the
 * download. That also keeps the output exactly what is on screen.
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
    </Button>
  );
}
