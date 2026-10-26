import { NextResponse } from "next/server";
import { AssumptionService } from "@/services/assumption-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || undefined;

    const stats = await AssumptionService.getAssumptionStats(workspaceId);
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch assumption statistics" },
      { status: 500 }
    );
  }
}
