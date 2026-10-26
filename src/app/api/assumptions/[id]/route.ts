import { NextResponse } from "next/server";
import { AssumptionService } from "@/services/assumption-service";
import { UpdateAssumptionSchema } from "@/types/decision";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assumption = await AssumptionService.getAssumptionById(id);

    if (!assumption) {
      return NextResponse.json(
        { success: false, error: "Assumption not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, assumption });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve assumption" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateAssumptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await AssumptionService.updateAssumption(id, parsed.data);
    return NextResponse.json({ success: true, assumption: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update assumption" },
      { status: 500 }
    );
  }
}
