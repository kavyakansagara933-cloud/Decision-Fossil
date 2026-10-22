import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreateDecisionSchema, CreateDecisionWizardSchema } from "@/types/decision";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("workspaceSlug") || "core-engineering";
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    const decisions = await DecisionService.listDecisions(workspace.id, {
      status,
      search,
    });

    return NextResponse.json({
      success: true,
      workspace,
      decisions,
    });
  } catch (error: any) {
    console.error("GET /api/decisions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch decisions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    const creatorId = body.creatorId || (await workspaceMemberOrCreatorId(workspace.id));
    const workspaceId = body.workspaceId || workspace.id;

    // Check if this is a comprehensive wizard submission (has alternatives, assumptions, evidence, or outcome)
    const isWizard =
      Array.isArray(body.alternatives) ||
      Array.isArray(body.assumptions) ||
      Array.isArray(body.evidence) ||
      body.outcome !== undefined;

    if (isWizard) {
      const parsedWizard = CreateDecisionWizardSchema.safeParse({
        ...body,
        workspaceId,
        creatorId,
      });

      if (!parsedWizard.success) {
        return NextResponse.json(
          { success: false, errors: parsedWizard.error.flatten() },
          { status: 400 }
        );
      }

      // 1. Create Decision Root
      const decision = await DecisionService.createDecision({
        workspaceId: parsedWizard.data.workspaceId,
        creatorId,
        title: parsedWizard.data.title,
        statement: parsedWizard.data.statement,
        priority: parsedWizard.data.priority,
        status: parsedWizard.data.status,
        context: parsedWizard.data.context,
        reasoning: parsedWizard.data.reasoning,
        reviewDate: parsedWizard.data.reviewDate ? new Date(parsedWizard.data.reviewDate).toISOString() : null,
        tags: parsedWizard.data.tags,
      });

      // 2. Add Alternatives
      if (parsedWizard.data.alternatives && parsedWizard.data.alternatives.length > 0) {
        for (const alt of parsedWizard.data.alternatives) {
          if (alt.name?.trim()) {
            await DecisionService.addAlternative({
              decisionId: decision.id,
              name: alt.name,
              description: alt.description,
              pros: alt.pros,
              cons: alt.cons,
              selectionReason: alt.selectionReason,
              status: alt.status,
              chosen: alt.chosen,
            });
          }
        }
      }

      // 3. Add Assumptions
      const createdAssumptionIds: string[] = [];
      if (parsedWizard.data.assumptions && parsedWizard.data.assumptions.length > 0) {
        for (const assump of parsedWizard.data.assumptions) {
          if (assump.statement?.trim()) {
            const { assumption } = await DecisionService.addAssumption({
              decisionId: decision.id,
              workspaceId,
              statement: assump.statement,
              importance: assump.importance,
              confidence: assump.confidence,
              status: assump.status,
              originalState: assump.originalState || assump.statement,
              impactNote: assump.impactNote,
            });
            createdAssumptionIds.push(assumption.id);
          }
        }
      }

      // 4. Attach Evidence
      if (parsedWizard.data.evidence && parsedWizard.data.evidence.length > 0) {
        for (const ev of parsedWizard.data.evidence) {
          if (ev.title?.trim()) {
            await DecisionService.addEvidence({
              decisionId: decision.id,
              workspaceId,
              title: ev.title,
              type: ev.type,
              source: ev.source,
              description: ev.description,
              note: ev.note,
              assumptionIds: createdAssumptionIds,
            });
          }
        }
      }

      // 5. Attach Outcome if provided
      if (parsedWizard.data.outcome && parsedWizard.data.outcome.expectedOutcome?.trim()) {
        await DecisionService.addOutcome({
          decisionId: decision.id,
          expectedOutcome: parsedWizard.data.outcome.expectedOutcome,
          actualOutcome: parsedWizard.data.outcome.actualOutcome,
          status: parsedWizard.data.outcome.status,
          measurement: parsedWizard.data.outcome.measurement,
          notes: parsedWizard.data.outcome.notes,
        });
      }

      const fullDecision = await DecisionService.getDecisionById(decision.id);
      return NextResponse.json({ success: true, decision: fullDecision }, { status: 201 });
    }

    // Standard basic creation
    const parsed = CreateDecisionSchema.safeParse({
      ...body,
      workspaceId,
      creatorId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const decision = await DecisionService.createDecision(parsed.data);
    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/decisions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create decision" },
      { status: 500 }
    );
  }
}

async function workspaceMemberOrCreatorId(workspaceId: string): Promise<string> {
  const ws = await WorkspaceService.getOrCreateDefaultWorkspace();
  const member = await (await import("@/lib/db")).prisma.workspaceMember.findFirst({
    where: { workspaceId: ws.id },
  });
  if (member) return member.userId;
  const user = await (await import("@/lib/db")).prisma.user.findFirst();
  return user ? user.id : "";
}
