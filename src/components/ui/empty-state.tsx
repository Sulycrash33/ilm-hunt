"use client"

import type { ReactNode } from "react"
import { Sprout, type LucideIcon } from "lucide-react"

export function EmptyState({ title, description, action, icon: Icon = Sprout }: {
  title?: string; description: string; action?: ReactNode; icon?: LucideIcon
}) {
  return <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 sm:p-8 text-center">
    <Icon className="mx-auto mb-4 h-9 w-9 text-primary" aria-hidden="true" />
    {title && <h2 className="mb-2 font-bold text-lg text-on-surface">{title}</h2>}
    <p className="mx-auto max-w-md text-sm leading-relaxed text-on-surface-variant">{description}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
}
