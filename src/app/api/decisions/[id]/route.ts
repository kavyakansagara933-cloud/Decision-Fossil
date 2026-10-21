import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";
import {
  UpdateDecisionStatusSchema,
  CreateAlternativeSchema,
  CreateAssumptionSchema,
  CreateEvidenceSchema,
  CreateOutcomeSchema,
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

    // Check if status transition
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

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update decision" },
      { status: 500 }
    );
  }
}
