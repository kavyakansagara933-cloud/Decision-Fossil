import { NextResponse } from "next/server";
import { HealthService } from "@/services/health-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || undefined;

    const overview = await HealthService.getWorkspaceHealthOverview(workspaceId);

    return NextResponse.json({
      success: true,
      ...overview,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load workspace health overview" },
      { status: 500 }
    );
  }
}
