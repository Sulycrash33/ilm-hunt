"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react"

/** Where each admin route sits, for the label beside the crumb. */
const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/categories": "Categories",
  "/admin/questions": "Questions",
  "/admin/explanations": "Explanations",
  "/admin/review": "Review Queue",
  "/admin/analytics": "Analytics",
  "/admin/audit": "Audit Log",
  "/admin/economy": "Economy",
  "/admin/moderation": "Moderation",
}

/**
 * Back and forward across the admin area.
 *
 * The sidebar could reach every page but nothing could return to the previous
 * one, so working through a list — open a category, go back, open the next —
 * meant re-navigating from the sidebar every time.
 *
 * `router.back()` does nothing when the admin page is the first entry in the
 * history, which is exactly the case when it was opened in a new tab. The
 * dashboard link beside it is the escape hatch for that: it always goes
 * somewhere, and on the dashboard itself it is dropped rather than pointing at
 * the page you are already on.
 */
export function AdminTopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const title = TITLES[pathname] ?? "Admin"
  const onDashboard = pathname === "/admin"

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/5 pb-3">
      <button
        onClick={() => router.back()}
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-on-surface hover:bg-white/5"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>
      <button
        onClick={() => router.forward()}
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-on-surface hover:bg-white/5"
        aria-label="Go forward"
      >
        Forward
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {!onDashboard && (
        <Link
          href="/admin"
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-on-surface-variant hover:bg-white/5"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
      )}

      <span className="ms-auto text-sm text-on-surface-variant">{title}</span>
    </div>
  )
}
