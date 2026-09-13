import { z } from "zod";

export const keyConceptSchema = z.object({
  term: z
    .string()
    .describe("The core concept, term, or mechanism name"),
  explanation: z
    .string()
    .describe("Clear, focused explanation strictly from the source material"),
  sourceReference: z
    .string()
    .describe(
      "Exact source file and page/slide/section citation provided in the input, e.g. 'Lecture 1.pdf · Page 3'"
    ),
  sourceExcerpt: z
    .string()
    .describe(
      "Short verbatim quote or sentence from the source text supporting this concept"
    ),
});

export const examTrapSchema = z.object({
  text: z
    .string()
    .describe(
      "Common mistake, subtle distinction, or misconception directly relevant to the topic"
    ),
  sourceReference: z
    .string()
    .describe("Exact source citation from the provided material"),
  sourceExcerpt: z
    .string()
    .describe(
      "Short verbatim quote from the source supporting the distinction"
    ),
});

export const quizQuestionSchema = z.object({
  question: z
    .string()
    .describe(
      "A targeted practice question testing comprehension of key facts or mechanisms"
    ),
  type: z
    .enum(["multiple_choice", "short_answer"])
    .describe(
      "Question format: multiple_choice (has 4 options) or short_answer (empty options array)"
    ),
  options: z
    .array(z.string())
    .describe(
      "4 answer options for multiple_choice questions; must be an empty array [] for short_answer questions"
    ),
  answer: z
    .string()
    .describe("The correct answer text or concise short-answer key"),
  explanation: z
    .string()
    .describe(
      "Brief pedagogical explanation of why this answer is correct based on the source"
    ),
  sourceReference: z
    .string()
    .describe("Exact source citation from the provided material"),
  sourceExcerpt: z
    .string()
    .describe(
      "Short verbatim quote from the source supporting the answer"
    ),
});

export const studyPackSchema = z.object({
  title: z
    .string()
    .describe(
      "A clear, concise, academic title for this study pack derived from the lecture material"
    ),
  overview: z
    .string()
    .describe(
      "A high-level synthesized 2-3 sentence revision overview of the material"
    ),
  keyConcepts: z
    .array(keyConceptSchema)
    .min(3)
    .max(7)
    .describe("3 to 7 core concept breakdown cards"),
  examTraps: z
    .array(examTrapSchema)
    .min(0)
    .max(4)
    .describe("0 to 4 likely exam traps or high-frequency errors"),
  quiz: z
    .array(quizQuestionSchema)
    .length(5)
    .describe("Exactly 5 practice questions testing the provided material"),
});

export type KeyConcept = z.infer<typeof keyConceptSchema>;
export type ExamTrap = z.infer<typeof examTrapSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type GeneratedStudyPack = z.infer<typeof studyPackSchema>;
