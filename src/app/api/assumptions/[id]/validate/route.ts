import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AssumptionService } from "@/services/assumption-service";
import { ValidateAssumptionSchema } from "@/types/decision";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assumptionId } = await params;
    const body = await request.json();

    const parsed = ValidateAssumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let decisionId = body.decisionId;
    if (!decisionId) {
      const link = await prisma.decisionAssumption.findFirst({
        where: { assumptionId },
      });
      if (!link) {
        return NextResponse.json(
          {
            success: false,
            error: "No decision associated with this assumption. Please specify decisionId.",
          },
          { status: 400 }
        );
      }
      decisionId = link.decisionId;
    }

    const result = await AssumptionService.validateAssumption(
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
