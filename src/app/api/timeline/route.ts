import { NextResponse } from "next/server";
import { TimelineService } from "@/services/timeline-service";
import { WorkspaceService } from "@/services/workspace-service";
import { TimelineQuerySchema } from "@/types/decision";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    let workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      const defaultWs = await WorkspaceService.getOrCreateDefaultWorkspace();
      workspaceId = defaultWs.id;
    }

    const queryInput = {
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
      order: searchParams.get("order") || undefined,
      category: searchParams.get("category") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      search: searchParams.get("search") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const parsed = TimelineQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await TimelineService.getTimelineEvents({
      workspaceId,
      ...parsed.data,
    });

    return NextResponse.json({
      success: true,
      events: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load activity timeline" },
      { status: 500 }
    );
  }
}
