import { prisma } from "@/lib/db";

export class WorkspaceService {
  /**
   * Ensure default workspace exists and return it (useful for zero-setup demo & local dev)
   */
  static async getOrCreateDefaultWorkspace() {
    let workspace = await prisma.workspace.findFirst({
      where: { slug: "core-engineering" },
    });

    if (!workspace) {
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: "Lead Architect",
            email: "architect@decisionfossil.dev",
            role: "ADMIN",
          },
        });
      }

      workspace = await prisma.workspace.create({
        data: {
          name: "Core Engineering",
          slug: "core-engineering",
          description: "Primary architectural and strategic decisions repository",
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
    }

    return workspace;
  }

  static async getWorkspaceBySlug(slug: string) {
    return await prisma.workspace.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }
}
