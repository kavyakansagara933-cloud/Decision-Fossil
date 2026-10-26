import { NextResponse } from "next/server";
import { AssumptionService } from "@/services/assumption-service";
import { CreateAssumptionSchema } from "@/types/decision";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || undefined;
    const decisionId = searchParams.get("decisionId") || undefined;
    const status = searchParams.get("status") || undefined;
    const isOverdue = searchParams.get("isOverdue") === "true";
    const search = searchParams.get("search") || undefined;

    const assumptions = await AssumptionService.listAssumptions({
      workspaceId,
      decisionId,
      status,
      isOverdue,
      search,
    });

    return NextResponse.json({ success: true, assumptions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list assumptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateAssumptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await AssumptionService.createAssumption(parsed.data);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create assumption" },
      { status: 500 }
    );
  }
}
