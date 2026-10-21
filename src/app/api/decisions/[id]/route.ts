import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";
import {
  UpdateDecisionSchema,
  UpdateDecisionStatusSchema,
  CreateAlternativeSchema,
  CreateAssumptionSchema,
  CreateEvidenceSchema,
  CreateOutcomeSchema,
  CreateDecisionEventSchema,
} from "@/types/decision";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decision = await DecisionService.getDecisionById(id);
    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, decision });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load decision" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 1. Status lifecycle transition
    if (body.action === "TRANSITION_STATUS") {
      const parsed = UpdateDecisionStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, errors: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const updated = await DecisionService.transitionStatus(id, parsed.data);
      return NextResponse.json({ success: true, decision: updated });
    }

    // 2. Full decision update with version snapshot
    const parsed = UpdateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await DecisionService.updateDecision(id, parsed.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update decision" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const body = await request.json();
    const { entityType } = body;

    switch (entityType) {
      case "ALTERNATIVE": {
        const parsed = CreateAlternativeSchema.safeParse({ ...body, decisionId });
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, errors: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const alternative = await DecisionService.addAlternative(parsed.data);
        return NextResponse.json({ success: true, alternative }, { status: 201 });
      }

      case "ASSUMPTION": {
        const parsed = CreateAssumptionSchema.safeParse({ ...body, decisionId });
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, errors: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const assumption = await DecisionService.addAssumption(parsed.data);
        return NextResponse.json({ success: true, ...assumption }, { status: 201 });
      }

      case "EVIDENCE": {
        const parsed = CreateEvidenceSchema.safeParse({ ...body, decisionId });
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, errors: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const evidence = await DecisionService.addEvidence(parsed.data);
        return NextResponse.json({ success: true, ...evidence }, { status: 201 });
      }

      case "OUTCOME": {
        const parsed = CreateOutcomeSchema.safeParse({ ...body, decisionId });
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, errors: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const outcome = await DecisionService.addOutcome(parsed.data);
        return NextResponse.json({ success: true, outcome }, { status: 201 });
      }

      case "EVENT": {
        const parsed = CreateDecisionEventSchema.safeParse({ ...body, decisionId });
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, errors: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const event = await DecisionService.createDecisionEvent(parsed.data);
        return NextResponse.json({ success: true, event }, { status: 201 });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid entityType. Must be ALTERNATIVE, ASSUMPTION, EVIDENCE, OUTCOME, or EVENT.",
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
