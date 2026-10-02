import { z } from "zod";

/** Validate reviewer input before a draft can be published. This validates
 * structure only; the reviewer remains responsible for factual accuracy. */
export const reviewEditSchema = z.object({
  questionText: z.string().trim().min(1, "Enter a question."),
  choices: z.array(z.string().trim().min(1, "Every choice needs text.")).min(2, "Provide at least two choices."),
  correctChoiceIndex: z.number().int().nonnegative(),
  explanation: z.string().trim().min(1, "Enter an explanation."),
  citationReference: z.string().trim().min(1, "Enter a citation before publishing."),
  madhabTag: z.enum(["agreed", "hanafi", "maliki", "shafii", "hanbali", "na"]),
}).superRefine((value, ctx) => {
  if (value.correctChoiceIndex >= value.choices.length) {
    ctx.addIssue({ code: "custom", path: ["correctChoiceIndex"], message: "Select a valid correct choice." });
  }
  const choices = value.choices.map(choice => choice.normalize("NFKC").toLocaleLowerCase("en"));
  if (new Set(choices).size !== choices.length) {
    ctx.addIssue({ code: "custom", path: ["choices"], message: "Answer choices must be distinct." });
  }
});

export type ReviewEdit = Omit<z.input<typeof reviewEditSchema>, "madhabTag"> & { madhabTag: string };
