import { NextResponse } from "next/server";
import { TimelineService } from "@/services/timeline-service";
import { TimelineQuerySchema } from "@/types/decision";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: decisionId } = await params;
    const { searchParams } = new URL(request.url);

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
      decisionId,
      ...parsed.data,
    });

    return NextResponse.json({
      success: true,
      events: result.events,
      pagination: result.pagination,
      timeline: result.events, // backward-compatibility alias
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load decision timeline" },
      { status: 500 }
    );
  }
}
