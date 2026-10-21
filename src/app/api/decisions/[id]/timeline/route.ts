import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const timeline = await DecisionService.getDecisionTimeline(id);
    return NextResponse.json({ success: true, timeline });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load timeline" },
      { status: 500 }
    );
  }
}
