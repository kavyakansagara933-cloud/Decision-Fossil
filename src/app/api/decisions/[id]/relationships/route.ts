import { NextResponse } from "next/server";
import { RelationshipService } from "@/services/relationship-service";
import { CreateRelationshipSchema } from "@/types/decision";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const result = await RelationshipService.getRelationships(decisionId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve relationships" },
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

    const payload = {
      sourceDecisionId: body.sourceDecisionId || decisionId,
      targetDecisionId: body.targetDecisionId,
      type: body.type,
      description: body.description,
    };

    const parsed = CreateRelationshipSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const relationship = await RelationshipService.addRelationship(
      parsed.data,
      body.actorId
    );

    return NextResponse.json(
      { success: true, relationship },
      { status: 201 }
    );
  } catch (error: any) {
    const isBadRequest =
      error.message?.includes("circular dependency") ||
      error.message?.includes("Cannot create a relationship between a decision and itself");
    const isNotFound = error.message?.includes("not found");

    return NextResponse.json(
      { success: false, error: error.message || "Failed to create relationship" },
      { status: isBadRequest ? 400 : isNotFound ? 404 : 500 }
    );
  }
}
