import { NextResponse } from "next/server";
import { DecisionService } from "@/services/decision-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreateDecisionSchema } from "@/types/decision";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("workspaceSlug") || "core-engineering";
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    const decisions = await DecisionService.listDecisions(workspace.id, {
      status,
      search,
    });

    return NextResponse.json({
      success: true,
      workspace,
      decisions,
    });
  } catch (error: any) {
    console.error("GET /api/decisions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch decisions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
    const parsed = CreateDecisionSchema.safeParse({
      ...body,
      workspaceId: body.workspaceId || workspace.id,
      creatorId: body.creatorId || (await workspaceMemberOrCreatorId(workspace.id)),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const decision = await DecisionService.createDecision(parsed.data);
    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/decisions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create decision" },
      { status: 500 }
    );
  }
}

async function workspaceMemberOrCreatorId(workspaceId: string): Promise<string> {
  const ws = await WorkspaceService.getOrCreateDefaultWorkspace();
  const member = await (await import("@/lib/db")).prisma.workspaceMember.findFirst({
    where: { workspaceId: ws.id },
  });
  if (member) return member.userId;
  const user = await (await import("@/lib/db")).prisma.user.findFirst();
  return user ? user.id : "";
}
