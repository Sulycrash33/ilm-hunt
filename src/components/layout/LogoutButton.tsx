"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/LanguageContext"

interface LogoutButtonProps {
  className?: string
  /** Show the label text next to the icon. Off by default for the compact
   * header placement; the profile page turns it on. */
  showLabel?: boolean
}

/**
 * Signs the current user out and sends them to /login.
 *
 * `signOut()` clears the session cookie the middleware reads on every
 * request, so the very next navigation to a protected route would already
 * redirect to /login on its own (see `updateSession`) — the explicit push
 * just gets there immediately instead of waiting for that to happen.
 */
export function LogoutButton({ className, showLabel = false }: LogoutButtonProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    if (loading) return
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label={t("logout")}
      className={
        "min-h-11 " + (className ??
        "flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high/60 px-3 py-1.5 text-on-surface-variant transition-colors hover:bg-error/15 hover:text-error disabled:opacity-60")
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      {showLabel && <span className="text-sm font-medium">{t("logout")}</span>}
    </button>
  )
}
