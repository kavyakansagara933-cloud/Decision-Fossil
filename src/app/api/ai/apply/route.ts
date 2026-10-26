import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DecisionService } from "@/services/decision-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ApplyExtractionRequestSchema } from "@/types/ai-extraction";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ApplyExtractionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid application payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    const user = await prisma.user.findFirst();
    const creatorId = user ? user.id : "";

    let decision: any;

    if (data.decisionId) {
      // Attaching accepted proposals to an existing decision record
      decision = await prisma.decision.findUnique({
        where: { id: data.decisionId },
      });
      if (!decision) {
        return NextResponse.json(
          { success: false, error: "Target decision record not found" },
          { status: 404 }
        );
      }

      // Log timeline event for extraction attachment
      await DecisionService.createDecisionEvent({
        decisionId: decision.id,
        actorId: creatorId,
        eventType: "CUSTOM",
        title: "AI Extraction Proposals Reviewed & Attached",
        detail: `User accepted ${data.acceptedAlternatives.length} alternatives, ${data.acceptedAssumptions.length} assumptions, and ${data.acceptedEvidence.length} evidence items from source '${data.sourceDocumentReference || "Imported Notes"}'.`,
        metadata: JSON.stringify({
          sourceDocument: data.sourceDocumentReference,
          acceptedCount:
            data.acceptedAlternatives.length +
            data.acceptedAssumptions.length +
            data.acceptedEvidence.length,
          rejectedSummary: data.rejectedSummary,
        }),
      });
    } else {
      // Creating a new decision fossil from accepted proposals
      decision = await DecisionService.createDecision({
        workspaceId: workspace.id,
        creatorId,
        title: data.title,
        statement: data.statement,
        priority: data.priority,
        status: data.isDraft ? "DRAFT" : data.status,
        context: data.context,
        reasoning: data.reasoning,
      });

      // Log timeline event for AI-assisted initialization
      await DecisionService.createDecisionEvent({
        decisionId: decision.id,
        actorId: creatorId,
        eventType: "CUSTOM",
        title: "Decision Created from Reviewed AI Extraction",
        detail: `Fossil initialized from source '${data.sourceDocumentReference || "Imported Text"}'. User verified all accepted entities.`,
        metadata: JSON.stringify({
          sourceDocument: data.sourceDocumentReference,
          isDraft: data.isDraft,
          rejectedSummary: data.rejectedSummary,
        }),
      });
    }

    // 1. Add Accepted Alternatives
    for (const alt of data.acceptedAlternatives) {
      await DecisionService.addAlternative({
        decisionId: decision.id,
        name: alt.name,
        description: alt.description,
        pros: alt.pros,
        cons: alt.cons,
        selectionReason: alt.selectionReason || (alt.sourceExcerpt ? `Excerpt: "${alt.sourceExcerpt.slice(0, 150)}"` : undefined),
        status: alt.status,
        chosen: alt.chosen,
      });
    }

    // 2. Add Accepted Assumptions
    const createdAssumptionIds: string[] = [];
    for (const assump of data.acceptedAssumptions) {
      const { assumption } = await DecisionService.addAssumption({
        decisionId: decision.id,
        workspaceId: workspace.id,
        statement: assump.statement,
        importance: assump.importance,
        confidence: assump.confidence,
        status: assump.status,
        originalState: assump.statement,
        impactNote: assump.impactNote || (assump.sourceExcerpt ? `Source context: "${assump.sourceExcerpt.slice(0, 150)}"` : undefined),
      });
      createdAssumptionIds.push(assumption.id);
    }

    // 3. Add Accepted Evidence & link to accepted assumptions
    for (const ev of data.acceptedEvidence) {
      await DecisionService.addEvidence({
        decisionId: decision.id,
        workspaceId: workspace.id,
        title: ev.title,
        type: ev.type,
        source: ev.source,
        description: ev.description || (ev.sourceExcerpt ? `Extracted from: "${ev.sourceExcerpt.slice(0, 200)}"` : undefined),
        assumptionIds: createdAssumptionIds,
      });
    }

    // 4. Add Outcome if defined
    if (data.expectedOutcome && data.expectedOutcome.trim().length > 0) {
      await DecisionService.addOutcome({
        decisionId: decision.id,
        expectedOutcome: data.expectedOutcome,
        status: "PENDING",
      });
    }

    const fullDecision = await DecisionService.getDecisionById(decision.id);

    return NextResponse.json({
      success: true,
      decision: fullDecision,
      appliedCounts: {
        alternatives: data.acceptedAlternatives.length,
        assumptions: data.acceptedAssumptions.length,
        evidence: data.acceptedEvidence.length,
      },
    });
  } catch (error: any) {
    console.error("Apply Extraction Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to commit accepted extraction." },
      { status: 500 }
    );
  }
}
