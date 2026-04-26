import type { FastifyInstance } from "fastify";
import { dashboardCapabilities } from "@open-practice/domain";

export function registerSessionRoutes(server: FastifyInstance): void {
  server.get("/api/session", async (request) => ({ user: request.auth.user }));

  server.get("/api/capabilities", async (request) => ({
    sections: dashboardCapabilities({
      user: request.auth.user,
      firmId: request.auth.firmId,
      matterId: request.auth.user.assignedMatterIds[0],
    }),
  }));
}
