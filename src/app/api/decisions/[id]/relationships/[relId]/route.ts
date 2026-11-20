import { NextResponse } from "next/server";
import { RelationshipService } from "@/services/relationship-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; relId: string }> }
) {
  try {
    const { relId } = await params;
    const removed = await RelationshipService.removeRelationship(relId);

    return NextResponse.json({
      success: true,
      removed,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("not found");
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove relationship" },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
