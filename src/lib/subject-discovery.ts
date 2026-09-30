import type { QuizCategory } from "./quiz-service"

export type SubjectFilter = "all" | "started" | "new"

export function filterSubjects(categories: QuizCategory[], query: string, filter: SubjectFilter): QuizCategory[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim()
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return categories.filter(category => {
    if (filter === "started" && category.answeredCount === 0) return false
    if (filter === "new" && (category.answeredCount > 0 || category.publishedCount === 0)) return false
    const haystack = normalize(`${category.name} ${category.description ?? ""}`)
    return words.every(word => haystack.includes(word))
  })
}
