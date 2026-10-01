"use client";

import { BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Names the real subject; a mode's title must never stand in for it. */
export function QuestionTopic({ name }: { name?: string }) {
  const { t } = useLanguage();
  if (!name?.trim()) return null;
  return <p className="relative flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
    <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{t("categoryLabel")}:</span>
    <bdi className="min-w-0 break-words font-medium">{name}</bdi>
  </p>;
}
