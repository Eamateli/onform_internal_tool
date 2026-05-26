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

type ActionKind = "invite" | "reject" | "block";

interface RequestActionsProps {
  requestId: string;
  email: string;
  canAct: boolean;
}

export function RequestActions({ requestId, email, canAct }: RequestActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<ActionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(kind: ActionKind) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/join-requests/${requestId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "invite" ? JSON.stringify({ role: "USER" }) : "{}",
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
        <Button size="sm" onClick={() => { setError(null); setOpen("invite"); }}>
          Invite
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setError(null); setOpen("reject"); }}
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => { setError(null); setOpen("block"); }}
        >
          Block
        </Button>
      </div>

      <Dialog open={open === "invite"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {email}?</DialogTitle>
            <DialogDescription>
              Sends a Clerk invitation and creates a USER account slot. They have
              48 hours to sign up.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => runAction("invite")} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "reject"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request?</DialogTitle>
            <DialogDescription>
              Silent — {email} will not be notified.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => runAction("reject")} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "block"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {email}?</DialogTitle>
            <DialogDescription>
              Adds their email and IP to the blocklist. Future access requests
              are silently dropped. No email is sent.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => runAction("block")} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
