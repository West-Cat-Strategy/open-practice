import type { FastifyInstance } from "fastify";
import type { IntakeFormRouteDependencies } from "./intake-forms/shared.js";
import { registerIntakeFormLinkRoutes } from "./intake-forms/links.js";
import { registerPublicIntakeFormRoutes } from "./intake-forms/public.js";
import { registerIntakeTemplateRoutes } from "./intake-forms/templates.js";

export function registerIntakeFormRoutes(
  server: FastifyInstance,
  dependencies: IntakeFormRouteDependencies,
): void {
  registerIntakeTemplateRoutes(server, dependencies);
  registerIntakeFormLinkRoutes(server, dependencies);
  registerPublicIntakeFormRoutes(server, dependencies);
}
