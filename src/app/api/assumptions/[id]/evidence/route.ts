import { NextResponse } from "next/server";
import { AssumptionService } from "@/services/assumption-service";
import { LinkEvidenceAssumptionSchema } from "@/types/decision";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assumptionId } = await params;
    const body = await request.json();

    const parsed = LinkEvidenceAssumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const link = await AssumptionService.linkEvidence(assumptionId, parsed.data);
    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to link evidence" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assumptionId } = await params;
    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("evidenceId");
    const actorId = searchParams.get("actorId") || undefined;

    if (!evidenceId) {
      return NextResponse.json(
        { success: false, error: "evidenceId query parameter is required" },
        { status: 400 }
      );
    }

    const result = await AssumptionService.unlinkEvidence(
      assumptionId,
      evidenceId,
      actorId
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to unlink evidence" },
      { status: 500 }
    );
  }
}
