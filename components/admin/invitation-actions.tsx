"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActionKind = "resend" | "revoke";

interface InvitationActionsProps {
  invitationId: string;
  email: string;
  canAct: boolean;
}

export function InvitationActions({
  invitationId,
  email,
  canAct,
}: InvitationActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<ActionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(kind: ActionKind) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invitations/${invitationId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      setOpen(null);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (!canAct) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null);
            setOpen("resend");
          }}
        >
          Resend
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setError(null);
            setOpen("revoke");
          }}
        >
          Revoke
        </Button>
      </div>

      <Dialog open={open === "resend"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend invitation to {email}?</DialogTitle>
            <DialogDescription>
              Revokes the old invite, creates a fresh one (48 hours), and sends
              a new email.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => runAction("resend")} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "revoke"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation?</DialogTitle>
            <DialogDescription>
              {email} will no longer be able to sign up with this invitation.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => runAction("revoke")}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
