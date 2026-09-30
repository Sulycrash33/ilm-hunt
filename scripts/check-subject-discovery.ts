import assert from "node:assert/strict"
import { filterSubjects } from "../src/lib/subject-discovery"
import type { QuizCategory } from "../src/lib/quiz-service"

const subjects: QuizCategory[] = [
  { id: "1", name: "Sīrah", slug: "sirah", description: "Life and history", icon: null, publishedCount: 8, answeredCount: 3 },
  { id: "2", name: "Révision du Coran", slug: "quran", description: null, icon: null, publishedCount: 4, answeredCount: 0 },
  { id: "3", name: "Coming topic", slug: "coming", description: "History", icon: null, publishedCount: 0, answeredCount: 0 },
  { id: "4", name: "القُرآن", slug: "arabic", description: null, icon: null, publishedCount: 6, answeredCount: 0 },
]
const snapshot = JSON.stringify(subjects)
assert.deepEqual(filterSubjects(subjects, " SIRAH ", "all").map(s => s.id), ["1"])
assert.deepEqual(filterSubjects(subjects, "revision coran", "all").map(s => s.id), ["2"])
assert.deepEqual(filterSubjects(subjects, "القرآن", "all").map(s => s.id), ["4"])
assert.deepEqual(filterSubjects(subjects, "history life", "all").map(s => s.id), ["1"])
assert.deepEqual(filterSubjects(subjects, "", "started").map(s => s.id), ["1"])
assert.deepEqual(filterSubjects(subjects, "", "new").map(s => s.id), ["2", "4"])
assert.deepEqual(filterSubjects(subjects, "Sīrah", "new"), [])
assert.deepEqual(filterSubjects(subjects, "unmatched", "all"), [])
assert.deepEqual(filterSubjects([], "", "all"), [])
assert.equal(JSON.stringify(subjects), snapshot)
console.log("Subject discovery: accents, Arabic diacritics, multiword search, filters, unavailable subjects and input immutability passed.")
