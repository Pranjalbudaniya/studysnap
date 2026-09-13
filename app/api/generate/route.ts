import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { studyPackSchema } from "../../../lib/study-schema";


export const maxDuration = 60;

// Default Gemini model identifier (configured to active gemini-3.6-flash)
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";




const MAX_CHARACTER_LIMIT = 120000;
const MIN_CHARACTER_LIMIT = 200;
const MIN_WORD_LIMIT = 40;

interface RequestChunk {
  id: string;
  label: string;
  sourceFileName: string;
  subLabel: string;
  text: string;
}

interface RequestPreferences {
  subject?: string;
  noteStyle?: "cram" | "clear" | "flashcard";
  difficulty?: "easy" | "mixed" | "challenging";
}

interface GenerateRequestBody {
  selectedChunks?: RequestChunk[];
  preferences?: RequestPreferences;
}

export async function POST(req: NextRequest) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };

  try {
    // 1. Validate API Key Presence
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          error:
            "AI generation is not configured yet. Please contact the app owner.",
        },
        { status: 500, headers }
      );
    }

    // 2. Parse & Validate Payload
    let body: GenerateRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request payload format." },
        { status: 400, headers }
      );
    }

    const chunks = body.selectedChunks || [];
    const preferences = body.preferences || {};

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Choose some material before generating your study pack.",
        },
        { status: 400, headers }
      );
    }

    // Filter valid chunks with actual text
    const validChunks = chunks.filter(
      (c) => typeof c.text === "string" && c.text.trim().length > 0
    );

    if (validChunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Choose some material before generating your study pack.",
        },
        { status: 400, headers }
      );
    }

    // Calculate total character count and word count
    const totalChars = validChunks.reduce(
      (acc, c) => acc + c.text.length,
      0
    );
    const totalWords = validChunks.reduce(
      (acc, c) => acc + c.text.trim().split(/\s+/).length,
      0
    );

    if (totalChars < MIN_CHARACTER_LIMIT || totalWords < MIN_WORD_LIMIT) {
      return NextResponse.json(
        {
          error:
            "There isn’t enough selected material to create a useful study pack.",
        },
        { status: 400, headers }
      );
    }

    if (totalChars > MAX_CHARACTER_LIMIT) {
      return NextResponse.json(
        {
          error:
            "Your selection is too large. Choose fewer pages, slides, or sections and try again.",
        },
        { status: 400, headers }
      );
    }

    // 3. Prepare Structured Material Context
    const availableSourceLabels = validChunks.map((c) => c.label);
    const materialPrompt = validChunks
      .map(
        (c, idx) => `=== SOURCE CHUNK ${idx + 1} ===
Source Reference: "${c.label}"
Source File: "${c.sourceFileName}"
Content:
${c.text.trim()}
`
      )
      .join("\n\n");

    const subject = preferences.subject || "General";
    const noteStyle = preferences.noteStyle || "clear";
    const difficulty = preferences.difficulty || "mixed";

    const styleInstruction =
      noteStyle === "cram"
        ? "High-density exam cram bullet points focusing on formulas, key mechanisms, and definitions."
        : noteStyle === "flashcard"
        ? "Concept-and-answer breakdown optimized for rapid active recall."
        : "Clear, cohesive explanations that make complex mechanisms easy to grasp.";

    const difficultyInstruction =
      difficulty === "easy"
        ? "Straightforward fundamental questions testing baseline definitions and direct facts."
        : difficulty === "challenging"
        ? "Rigorous questions testing edge cases, multi-step mechanisms, and subtle distinctions."
        : "A balanced mix of foundational recall and conceptual understanding.";

    const systemPrompt = `You are StudySnap, a precision academic revision engine.
Your task is to transform the supplied lecture material into a structured study pack consisting of revision notes and exactly 5 practice questions.

STRICT GROUNDING & FIDELITY RULES:
1. Grounding: Use ONLY the provided lecture material chunks. Never use outside knowledge or extrapolate unsupported facts.
2. Zero Hallucination: If a concept or fact is not directly supported by the text, omit it.
3. Citations & References:
   - Every 'sourceReference' MUST be one of these exact available labels:
     ${JSON.stringify(availableSourceLabels, null, 2)}
   - Never invent page numbers, slide numbers, or filename citations.
4. Verbatim Excerpts:
   - Every 'sourceExcerpt' MUST be a short, verbatim quote or sentence directly extracted from the cited chunk.
5. Content Requirements:
   - Title: An academic, descriptive title summarizing the topic.
   - Overview: A concise 2-3 sentence revision summary.
   - Key Concepts: 3 to 7 core concept breakdown cards.
   - Exam Traps: 0 to 4 common student misconceptions or subtle pitfalls where marks are easily lost.
   - Quiz: EXACTLY 5 questions based strictly on the material:
     * For 'multiple_choice' questions: provide exactly 4 options in the options array.
     * For 'short_answer' questions: provide an empty array [] for the options field.
     * Provide a clear correct 'answer', a brief pedagogical 'explanation', and valid 'sourceReference' and 'sourceExcerpt'.
6. Study Preferences:
   - Subject: ${subject}
   - Style: ${styleInstruction}
   - Difficulty: ${difficultyInstruction}
7. Format: Output only the structured JSON matching the provided schema.`;

    // 4. Execute AI Generation with Google Gemini
    const { object: studyPack } = await generateObject({
      model: google(DEFAULT_GEMINI_MODEL),
      schema: studyPackSchema,
      system: systemPrompt,
      prompt: `Please create the revision notes and 5 practice questions from this selected lecture material:\n\n${materialPrompt}`,
    });

    // 5. Return Validated Study Pack
    return NextResponse.json({ studyPack }, { headers });
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: string;
      name?: string;
    };

    const status = err.status || err.statusCode || 500;


    const msg = (err.message || "").toLowerCase();

    // Map errors to friendly user-facing messages
    if (
      status === 401 ||
      status === 403 ||
      msg.includes("api_key_invalid") ||
      msg.includes("unauthenticated") ||
      msg.includes("unauthorized")
    ) {
      return NextResponse.json(
        {
          error:
            "The AI service could not authenticate. Please contact the app owner.",
        },
        { status: 401, headers }
      );
    }

    if (
      status === 429 ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota") ||
      msg.includes("rate limit")
    ) {
      return NextResponse.json(
        {
          error:
            "The AI service is busy right now. Please wait a moment and try again.",
        },
        { status: 429, headers }
      );
    }

    if (
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("network") ||
      msg.includes("timeout")
    ) {
      return NextResponse.json(
        {
          error:
            "We couldn’t reach the AI service. Check your connection and try again.",
        },
        { status: 503, headers }
      );
    }

    if (
      err.name === "ZodError" ||
      msg.includes("schema") ||
      msg.includes("parse") ||
      msg.includes("validation")
    ) {
      return NextResponse.json(
        {
          error:
            "We couldn’t safely structure this study pack. Please try again.",
        },
        { status: 422, headers }
      );
    }

    return NextResponse.json(
      {
        error:
          "We couldn’t safely structure this study pack. Please try again.",
      },
      { status: 500, headers }
    );
  }
}
