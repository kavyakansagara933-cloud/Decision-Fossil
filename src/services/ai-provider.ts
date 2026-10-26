import {
  ReasoningExtractionResult,
  ReasoningExtractionResultSchema,
} from "@/types/ai-extraction";

export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  extractReasoning(text: string): Promise<ReasoningExtractionResult>;
}

/**
 * Deterministic Mock Provider:
 * Used in development, testing, or when external API keys are not provided.
 * Faithfully matches real source excerpts directly to the input text and cleanly
 * differentiates explicit statements from inferences.
 */
export class MockAIProvider implements AIProvider {
  name = "deterministic-mock-provider";

  isAvailable(): boolean {
    return true;
  }

  async extractReasoning(text: string): Promise<ReasoningExtractionResult> {
    // Basic deterministic extraction parser scanning for decision signals
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const fullText = text;

    // 1. Identify Title & Decision Statement
    let title = "Extracted Architectural Decision";
    let statement = "The team resolved to adopt the architecture outlined in the provided discussion.";
    let statementExcerpt = "";

    const decisionLine = lines.find((l) =>
      /decid(ed|e|ing)|agreed|standardiz(e|ed)|chosen|adopt(ed|ing)?/i.test(l)
    );
    if (decisionLine) {
      statement = decisionLine.replace(/^[-*•0-9.)\s]+/, "");
      statementExcerpt = decisionLine;
      const titleMatch = statement.match(/^(?:we (?:have )?decided to |agreed to |adopt |standardize on )(.*)/i);
      if (titleMatch && titleMatch[1]) {
        title = `Adopt ${titleMatch[1].replace(/[.!]+$/, "").slice(0, 80)}`;
      } else {
        title = statement.slice(0, 80);
      }
    } else if (lines.length > 0) {
      title = lines[0].replace(/^[-*#•\s]+/, "").slice(0, 80);
      statement = lines[0];
      statementExcerpt = lines[0];
    }

    // 2. Identify Context / Problem
    let context: string | undefined;
    let contextExcerpt: string | undefined;
    const problemLine = lines.find((l) =>
      /problem|context|currently|bottleneck|issue|challenge|struggling/i.test(l)
    );
    if (problemLine) {
      context = problemLine.replace(/^[-*•0-9.)\s]+/, "");
      contextExcerpt = problemLine;
    }

    // 3. Identify Rationale / Why
    let reasoning: string | undefined;
    let reasoningExcerpt: string | undefined;
    const whyLine = lines.find((l) =>
      /because|rationale|why|reason|in order to|benefits|allows us to/i.test(l)
    );
    if (whyLine) {
      reasoning = whyLine.replace(/^[-*•0-9.)\s]+/, "");
      reasoningExcerpt = whyLine;
    }

    // 4. Identify Alternatives
    const alternatives: any[] = [];
    let altId = 1;

    // Check for section-based alternatives (e.g. Alternatives: \n 1. Option A ...)
    let inAltSection = false;
    for (const l of lines) {
      const trimmed = l.trim();
      if (/^(?:#+\s*)?(?:alternatives?|options?|considered options?)\s*[:\-]?\s*$/i.test(trimmed)) {
        inAltSection = true;
        continue;
      }
      if (inAltSection) {
        if (/^(?:#+\s*)?(?:assumptions?|evidence?|risks?|outcome|decision|problem|context)/i.test(trimmed)) {
          inAltSection = false;
        } else if (/^[-*•0-9.)\s]+[A-Za-z0-9]/.test(trimmed)) {
          const cleanLine = trimmed.replace(/^[-*•0-9.)\s]+/, "").trim();
          const parts = cleanLine.split(/[:\-–—]/);
          const name = parts[0].trim();
          const desc = parts.slice(1).join(":").trim() || "Considered alternative from source discussion.";
          const isChosen = /selected|chosen|adopted|accepted|winner/i.test(cleanLine);
          alternatives.push({
            id: `alt-${altId++}`,
            name: name.slice(0, 50),
            description: desc,
            pros: isChosen ? "Primary recommended solution in discussion" : undefined,
            cons: !isChosen ? "Trade-offs or overhead noted in notes" : undefined,
            status: isChosen ? "SELECTED" : "CONSIDERED",
            chosen: isChosen,
            sourceExcerpt: l,
            traceability: "EXPLICIT",
            confidence: 0.9,
          });
        }
      }
    }

    // Also scan for inline alternatives (e.g., "instead of memcached", "alternative: X")
    const altRegex = /(?:alternative|considered|evaluated|vs\.?|option|instead of|compared to)\s*[:\-]?\s*([^.,;\n]+)/gi;
    let altMatch;
    while ((altMatch = altRegex.exec(fullText)) !== null) {
      const candidateName = altMatch[1].trim();
      if (candidateName.length > 2 && candidateName.length < 50 && !alternatives.some((a) => a.name.toLowerCase() === candidateName.toLowerCase())) {
        alternatives.push({
          id: `alt-${altId++}`,
          name: candidateName,
          description: `Considered as an alternative in the source discussion.`,
          status: "CONSIDERED",
          chosen: false,
          sourceExcerpt: altMatch[0],
          traceability: "EXPLICIT",
          confidence: 0.85,
        });
      }
    }

    // Fallback alternative if none found
    if (alternatives.length === 0) {
      const altLine = lines.find((l) => /alternatives?|options?/i.test(l));
      if (altLine) {
        alternatives.push({
          id: "alt-1",
          name: altLine.slice(0, 40),
          description: "Alternative candidate identified from discussion line.",
          status: "CONSIDERED",
          chosen: false,
          sourceExcerpt: altLine,
          traceability: "EXPLICIT",
          confidence: 0.8,
        });
      }
    }

    // Ensure at least one alternative is marked chosen if matching statement
    if (!alternatives.some((a) => a.chosen) && alternatives.length > 0) {
      const statementLower = statement.toLowerCase();
      const bestMatch = alternatives.find((a) => statementLower.includes(a.name.toLowerCase())) || alternatives[0];
      bestMatch.chosen = true;
      bestMatch.status = "SELECTED";
    }

    // 5. Identify Assumptions
    const assumptions: any[] = [];
    let assumpId = 1;
    lines.forEach((l) => {
      if (/assum(e|ing|ption)|expect(ing|ed)?|under|threshold|remain below|traffic|estimate/i.test(l)) {
        assumptions.push({
          id: `assump-${assumpId++}`,
          statement: l.replace(/^[-*•0-9.)\s]+/, ""),
          importance: "HIGH",
          confidence: "MEDIUM",
          originalState: l.replace(/^[-*•0-9.)\s]+/, ""),
          impactNote: "If invalidated, decision stability must be re-evaluated.",
          sourceExcerpt: l,
          traceability: "EXPLICIT",
          confidenceScore: 0.88,
        });
      }
    });

    // Fallback assumption if none explicitly articulated
    if (assumptions.length === 0) {
      assumptions.push({
        id: "assump-1",
        statement: `Current architectural constraints and operational demands remain within expected parameters.`,
        importance: "MEDIUM",
        confidence: "MEDIUM",
        originalState: "Inferred operational baseline stability.",
        impactNote: "System requirements are assumed to remain consistent over the decision lifecycle.",
        sourceExcerpt: fullText.slice(0, 100),
        traceability: "INFERRED",
        confidenceScore: 0.75,
      });
    }

    // 6. Identify Evidence (URLs, benchmarks, telemetry)
    const evidence: any[] = [];
    let evId = 1;
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(fullText)) !== null) {
      evidence.push({
        id: `ev-${evId++}`,
        title: `Referenced Link: ${urlMatch[1].slice(0, 45)}...`,
        type: "URL",
        source: urlMatch[1],
        description: "Direct URL reference cited in discussion.",
        sourceExcerpt: urlMatch[1],
        traceability: "EXPLICIT",
        confidence: 0.95,
      });
    }
    lines.forEach((l) => {
      if (/benchmark|telemetry|metrics?|tested|measured|latency|load test/i.test(l) && !l.includes("http")) {
        evidence.push({
          id: `ev-${evId++}`,
          title: "Observed Benchmark or Telemetry Metric",
          type: "BENCHMARK",
          source: "Source discussion observation",
          description: l.replace(/^[-*•0-9.)\s]+/, ""),
          sourceExcerpt: l,
          traceability: "EXPLICIT",
          confidence: 0.82,
        });
      }
    });

    // 7. Identify Risks
    const risks: any[] = [];
    let riskId = 1;
    lines.forEach((l) => {
      if (/risk|downside|drawback|concern|danger|failure|bottleneck|vulnerability/i.test(l)) {
        risks.push({
          id: `risk-${riskId++}`,
          risk: l.replace(/^[-*•0-9.)\s]+/, ""),
          severity: "MEDIUM",
          sourceExcerpt: l,
          traceability: "EXPLICIT",
        });
      }
    });

    // 8. Identify Open Questions / Inferences
    const openQuestions: any[] = [];
    let qId = 1;
    lines.forEach((l) => {
      if (l.includes("?") || /question|tbd|unknown|need to verify|unclear/i.test(l)) {
        openQuestions.push({
          id: `q-${qId++}`,
          question: l.replace(/^[-*•0-9.)\s]+/, ""),
          sourceExcerpt: l,
          traceability: "EXPLICIT",
        });
      }
    });

    // 9. Stakeholders
    const stakeholders: any[] = [];
    let sId = 1;
    const stakeholderLine = lines.find((l) => /lead|architect|team|owner|cto|pm|devon|marcus|elena|sophia/i.test(l));
    if (stakeholderLine) {
      stakeholders.push({
        id: `s-${sId++}`,
        nameOrRole: stakeholderLine.slice(0, 50),
        sourceExcerpt: stakeholderLine,
        traceability: "EXPLICIT",
      });
    }

    const result: ReasoningExtractionResult = {
      title,
      statement: statement.length >= 10 ? statement : `${statement} (Standardized architecture)`,
      priority: "MEDIUM",
      status: "PROPOSED",
      context,
      reasoning,
      statementExcerpt,
      contextExcerpt,
      reasoningExcerpt,
      alternatives,
      assumptions,
      evidence,
      risks,
      openQuestions,
      stakeholders,
      provider: this.name,
      model: "regex-heuristic-extractor-v1",
      extractedAt: new Date().toISOString(),
    };

    return ReasoningExtractionResultSchema.parse(result);
  }
}

/**
 * Gemini AI Provider:
 * Connects to Google Gemini API via official endpoint using server-side GEMINI_API_KEY.
 * Employs structured output prompting and strict Zod schema validation.
 */
export class GeminiAIProvider implements AIProvider {
  name = "gemini-ai-provider";
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async extractReasoning(text: string): Promise<ReasoningExtractionResult> {
    if (!this.isAvailable()) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not configured. Please supply a key or use the development mock adapter."
      );
    }

    const prompt = `You are Decision Fossil's AI Reasoning Extraction Engine.
Analyze the following source text and extract structured architectural and decision intelligence.

CRITICAL INSTRUCTIONS FOR SOURCE TRACEABILITY:
1. Every extracted alternative, assumption, evidence, risk, and question MUST cite its exact supporting source excerpt directly from the source text.
2. Clearly distinguish EXPLICIT statements from INFERRED observations using the traceability field ("EXPLICIT" or "INFERRED").
3. DO NOT fabricate URLs, benchmark figures, or quotes that do not appear in the source text.
4. Output valid JSON adhering strictly to this schema:

{
  "title": "string (min 3 chars)",
  "statement": "string (min 10 chars, formal decision statement)",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "status": "PROPOSED" | "DRAFT" | "DECIDED",
  "context": "string (problem space & constraints)",
  "reasoning": "string (primary rationale / why)",
  "statementExcerpt": "string (exact excerpt from source)",
  "contextExcerpt": "string (exact excerpt from source)",
  "reasoningExcerpt": "string (exact excerpt from source)",
  "expectedOutcome": "string (optional expected outcome)",
  "expectedOutcomeExcerpt": "string (optional)",
  "alternatives": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "pros": "string",
      "cons": "string",
      "selectionReason": "string",
      "status": "CONSIDERED" | "SELECTED" | "REJECTED",
      "chosen": boolean,
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED",
      "confidence": number between 0 and 1
    }
  ],
  "assumptions": [
    {
      "id": "string",
      "statement": "string (what must be true for decision to work)",
      "importance": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "confidence": "LOW" | "MEDIUM" | "HIGH",
      "originalState": "string",
      "impactNote": "string",
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED",
      "confidenceScore": number between 0 and 1
    }
  ],
  "evidence": [
    {
      "id": "string",
      "title": "string",
      "type": "NOTE" | "URL" | "DOCUMENT" | "BENCHMARK" | "DATASET" | "EXPERIMENT" | "DISCUSSION" | "OTHER",
      "source": "string",
      "description": "string",
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED",
      "confidence": number between 0 and 1
    }
  ],
  "risks": [
    {
      "id": "string",
      "risk": "string",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "mitigation": "string",
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED"
    }
  ],
  "openQuestions": [
    {
      "id": "string",
      "question": "string",
      "impact": "string",
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED"
    }
  ],
  "stakeholders": [
    {
      "id": "string",
      "nameOrRole": "string",
      "role": "string",
      "sourceExcerpt": "string",
      "traceability": "EXPLICIT" | "INFERRED"
    }
  ]
}

SOURCE TEXT:
${text}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Provider API Error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const responseData = await response.json();
    const candidateText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("Gemini provider returned an empty or malformed candidate payload.");
    }

    const parsedJson = JSON.parse(candidateText);
    const validated = ReasoningExtractionResultSchema.parse({
      ...parsedJson,
      provider: "google-gemini",
      model: "gemini-1.5-flash",
      extractedAt: new Date().toISOString(),
    });

    return validated;
  }
}

/**
 * AI Provider Factory:
 * Selects Gemini provider if GEMINI_API_KEY is present, otherwise falls back
 * transparently to the deterministic MockAIProvider with clear provenance.
 */
export function getAIProvider(): { provider: AIProvider; isMock: boolean } {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    return {
      provider: new GeminiAIProvider(geminiKey),
      isMock: false,
    };
  }

  return {
    provider: new MockAIProvider(),
    isMock: true,
  };
}
