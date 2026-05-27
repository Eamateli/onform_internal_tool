import { FileSpreadsheet, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClientExportButtonsProps {
  clientId: string;
}

export function ClientExportButtons({ clientId }: ClientExportButtonsProps) {
  const base = `/api/clients/${clientId}/export`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`${base}/excel`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Export Excel
      </a>
      <a
        href={`${base}/pdf`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <FileText className="h-3.5 w-3.5" />
        Export PDF
      </a>
    </div>
  );
}
