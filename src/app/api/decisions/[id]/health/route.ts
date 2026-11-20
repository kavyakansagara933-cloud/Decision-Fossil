import { NextResponse } from "next/server";
import { HealthService } from "@/services/health-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const health = await HealthService.calculateDecisionHealth(decisionId);

    return NextResponse.json({
      success: true,
      health,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("not found");
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate decision health" },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
