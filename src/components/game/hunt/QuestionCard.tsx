"use client";

import { motion } from "framer-motion";
import { IslamicPattern } from "@/components/islamic-pattern";
import { useGameReducedMotion } from "@/contexts/GameExperienceContext";
import { QuestionTopic } from "./QuestionTopic";

interface QuestionCardProps {
  text: string;
  /** A raised question surface with the app's existing khatim motif. */
  questionId: string;
  categoryName?: string;
}

/**
 * The question itself, set in the display serif on a raised surface with the
 * eight-point star motif bleeding out of the bottom corner — the shape the
 * Stitch reference uses to mark "this is the thing you're answering".
 *
 * The star is decorative and deliberately low-contrast; it sits behind the
 * text at low opacity so it never competes with reading.
 */
export function QuestionCard({ text, questionId, categoryName }: QuestionCardProps) {
  const reduce = useGameReducedMotion();
  return (
    <motion.div
      key={questionId}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-surface-container p-6 sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden="true"><IslamicPattern variant="flat" /></div>

      {categoryName && <div className="mb-3"><QuestionTopic name={categoryName} /></div>}
      <h2 className="relative font-headline text-2xl leading-snug text-on-surface sm:text-3xl">
        {text}
      </h2>
    </motion.div>
  );
}
