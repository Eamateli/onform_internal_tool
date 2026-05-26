// /admin → /admin/requests
//
// We don't have a meaningful index page for /admin itself — the three tabs
// (Requests / Users / Invitations) are the actual UI. Send the visitor to
// the most actionable one. Auth gate runs in the parent layout.

import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/admin/requests");
}
