import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";
import { ValidateAssumptionSchema } from "@/types/decision";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const body = await request.json();
    const { assumptionId } = body;

    if (!assumptionId) {
      return NextResponse.json(
        { success: false, error: "assumptionId is required" },
        { status: 400 }
      );
    }

    const parsed = ValidateAssumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await DecisionService.validateAssumption(
      assumptionId,
      decisionId,
      parsed.data
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to validate assumption" },
      { status: 500 }
    );
  }
}
