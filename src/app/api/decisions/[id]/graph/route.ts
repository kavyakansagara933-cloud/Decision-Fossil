import { NextResponse } from "next/server";
import { RelationshipService } from "@/services/relationship-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const { searchParams } = new URL(request.url);
    const depth = parseInt(searchParams.get("depth") || "2", 10);

    const graph = await RelationshipService.getDecisionGraph(decisionId, depth);

    return NextResponse.json({
      success: true,
      graph,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("not found");
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load decision graph" },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
