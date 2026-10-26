import { NextResponse } from "next/server";
import { getAIProvider } from "@/services/ai-provider";
import { WorkspaceService } from "@/services/workspace-service";
import { ExtractReasoningRequestSchema } from "@/types/ai-extraction";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ExtractReasoningRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid extraction request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { text, workspaceId, documentReference } = parsed.data;

    // Verify workspace exists & access
    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Requested workspace not found or inaccessible" },
        { status: 404 }
      );
    }

    // Resolve AI provider (Gemini or Mock)
    const { provider, isMock } = getAIProvider();

    const extraction = await provider.extractReasoning(text);

    return NextResponse.json({
      success: true,
      extraction: {
        ...extraction,
        documentReference: documentReference || "Direct User Input",
        sourceTextLength: text.length,
      },
      providerInfo: {
        name: provider.name,
        isMock,
        model: extraction.model,
        warning: isMock
          ? "No GEMINI_API_KEY detected in environment. Using deterministic fallback extraction adapter."
          : null,
      },
    });
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during reasoning extraction.",
      },
      { status: 500 }
    );
  }
}
