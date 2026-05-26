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

type ActionKind = "promote" | "demote" | "block" | "unblock" | "remove";

interface UserActionsProps {
  userId: string;
  email: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "BLOCKED";
  isSelf: boolean;
}

export function UserActions({
  userId,
  email,
  role,
  status,
  isSelf,
}: UserActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<ActionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(kind: ActionKind) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${kind}`, {
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

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  const roleAction: ActionKind = role === "ADMIN" ? "demote" : "promote";
  const statusAction: ActionKind = status === "ACTIVE" ? "block" : "unblock";

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null);
            setOpen(roleAction);
          }}
        >
          {role === "ADMIN" ? "Demote" : "Promote"}
        </Button>
        <Button
          size="sm"
          variant={status === "ACTIVE" ? "destructive" : "default"}
          onClick={() => {
            setError(null);
            setOpen(statusAction);
          }}
        >
          {status === "ACTIVE" ? "Block" : "Unblock"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-600 hover:text-rose-700"
          onClick={() => {
            setError(null);
            setOpen("remove");
          }}
        >
          Remove
        </Button>
      </div>

      <ConfirmDialog
        open={open === "promote"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={`Promote ${email} to admin?`}
        description="They will be able to access the Admin panel and manage users."
        confirmLabel="Promote"
        loading={loading}
        error={error}
        onConfirm={() => runAction("promote")}
        onCancel={() => setOpen(null)}
      />

      <ConfirmDialog
        open={open === "demote"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={`Demote ${email}?`}
        description="They will lose admin access but keep their account."
        confirmLabel="Demote"
        destructive
        loading={loading}
        error={error}
        onConfirm={() => runAction("demote")}
        onCancel={() => setOpen(null)}
      />

      <ConfirmDialog
        open={open === "block"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={`Block ${email}?`}
        description="Revokes their Clerk session, blocklists their email, and sets status to BLOCKED."
        confirmLabel="Block"
        destructive
        loading={loading}
        error={error}
        onConfirm={() => runAction("block")}
        onCancel={() => setOpen(null)}
      />

      <ConfirmDialog
        open={open === "unblock"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={`Unblock ${email}?`}
        description="Removes the email blocklist entry and restores ACTIVE status."
        confirmLabel="Unblock"
        loading={loading}
        error={error}
        onConfirm={() => runAction("unblock")}
        onCancel={() => setOpen(null)}
      />

      <ConfirmDialog
        open={open === "remove"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={`Remove ${email}?`}
        description="Permanently deletes their Clerk account and removes them from the database. This cannot be undone."
        confirmLabel="Remove"
        destructive
        loading={loading}
        error={error}
        onConfirm={() => runAction("remove")}
        onCancel={() => setOpen(null)}
      />
    </>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
