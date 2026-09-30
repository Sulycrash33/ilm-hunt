"use client"

import { QuizCategoriesGrid } from "./QuizCategoriesGrid"

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  description?: string
  publishedCount: number
  answeredCount: number
}

export function QuizCategoriesClient({ categories }: { categories: Category[] }) {
  return <QuizCategoriesGrid categories={categories.map(category => ({ ...category, icon: category.icon ?? null, description: category.description ?? null }))} />
}
