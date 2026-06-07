import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import { registerPublicConsultationSubmissionRoutes } from "./public-consultation-intakes/public.js";
import { registerStaffPublicConsultationIntakeRoutes } from "./public-consultation-intakes/staff.js";
import type { ApiJobQueue } from "./types.js";

export function registerPublicConsultationIntakeRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    emailJobQueue?: ApiJobQueue;
    publicFirmId: string;
    publicActorUserId: string;
    jwtSecret?: string;
  },
): void {
  registerStaffPublicConsultationIntakeRoutes(server, options);
  registerPublicConsultationSubmissionRoutes(server, options);
}
