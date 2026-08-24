import type { Express, RequestHandler } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertPersonSchema,
  updatePersonSchema,
  insertInteractionSchema,
  updateInteractionSchema,
  loginSchema,
  createLeadRequestSchema,
  updateLeadSchema,
  updateSettingsSchema,
  insertStageConfigSchema,
  updateStageConfigSchema,
  reorderStagesSchema,
} from "@shared/schema";
import { verifyPassphrase, issueToken, requireAuth } from "./auth";
import * as storage from "./storage";
import { generateReconnectSuggestion } from "./services/suggestions";

// Express 4 doesn't catch rejected promises from async handlers — without
// this, a thrown error (e.g. DATABASE_URL unset) takes down the whole
// process instead of producing a 500. Wrapping routes funnels errors into
// the error-handling middleware in index.ts.
function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export async function registerRoutes(app: Express): Promise<void> {
  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      try {
        const { passphrase } = loginSchema.parse(req.body);
        const valid = await verifyPassphrase(passphrase);
        if (!valid) {
          return res.status(401).json({ error: "Invalid passphrase" });
        }
        res.json({ token: issueToken() });
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.get("/api/auth/me", requireAuth, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.use("/api/people", requireAuth);
  app.use("/api/interactions", requireAuth);
  app.use("/api/reminders", requireAuth);
  app.use("/api/leads", requireAuth);
  app.use("/api/settings", requireAuth);
  app.use("/api/stages", requireAuth);

  app.get(
    "/api/people",
    asyncHandler(async (_req, res) => {
      res.json(await storage.listPeople());
    }),
  );

  app.post(
    "/api/people",
    asyncHandler(async (req, res) => {
      try {
        const input = insertPersonSchema.parse(req.body);
        res.status(201).json(await storage.createPerson(input));
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.get(
    "/api/people/:id",
    asyncHandler(async (req, res) => {
      const person = await storage.getPerson(req.params.id);
      if (!person) return res.status(404).json({ error: "Not found" });
      res.json(person);
    }),
  );

  app.patch(
    "/api/people/:id",
    asyncHandler(async (req, res) => {
      try {
        const input = updatePersonSchema.parse(req.body);
        const person = await storage.updatePerson(req.params.id, input);
        if (!person) return res.status(404).json({ error: "Not found" });
        res.json(person);
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.delete(
    "/api/people/:id",
    asyncHandler(async (req, res) => {
      await storage.deletePerson(req.params.id);
      res.status(204).end();
    }),
  );

  app.get(
    "/api/people/:id/interactions",
    asyncHandler(async (req, res) => {
      res.json(await storage.listInteractions(req.params.id));
    }),
  );

  app.post(
    "/api/people/:id/interactions",
    asyncHandler(async (req, res) => {
      try {
        const input = insertInteractionSchema.parse({ ...req.body, personId: req.params.id });
        res.status(201).json(await storage.createInteraction(input));
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.patch(
    "/api/people/:personId/interactions/:id",
    asyncHandler(async (req, res) => {
      try {
        const input = updateInteractionSchema.parse(req.body);
        const interaction = await storage.updateInteraction(req.params.id, req.params.personId, input);
        if (!interaction) return res.status(404).json({ error: "Not found" });
        res.json(interaction);
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.delete(
    "/api/people/:personId/interactions/:id",
    asyncHandler(async (req, res) => {
      await storage.deleteInteraction(req.params.id, req.params.personId);
      res.status(204).end();
    }),
  );

  app.get(
    "/api/reminders/due",
    asyncHandler(async (_req, res) => {
      res.json(await storage.listDueForReconnect());
    }),
  );

  app.post(
    "/api/people/:id/suggestions",
    asyncHandler(async (req, res) => {
      const person = await storage.getPerson(req.params.id);
      if (!person) return res.status(404).json({ error: "Not found" });

      const interactions = await storage.listInteractions(person.id);
      const { suggestion, model } = await generateReconnectSuggestion(person, interactions);
      const row = await storage.createSuggestion({
        personId: person.id,
        openingLine: suggestion.openingLine,
        talkingPoints: suggestion.talkingPoints,
        model,
      });
      res.status(201).json(row);
    }),
  );

  app.get(
    "/api/people/:id/suggestions/latest",
    asyncHandler(async (req, res) => {
      const suggestion = await storage.getLatestSuggestion(req.params.id);
      if (!suggestion) return res.status(404).json({ error: "No suggestion yet" });
      res.json(suggestion);
    }),
  );

  // Registered before /api/leads/:id-shaped routes for clarity, even though
  // there's no path-param collision today.
  app.get(
    "/api/leads/touches",
    asyncHandler(async (req, res) => {
      const weeks = Math.max(1, parseInt(String(req.query.weeks ?? "12"), 10) || 12);
      res.json(await storage.listOutreachTouches(weeks));
    }),
  );

  app.get(
    "/api/leads",
    asyncHandler(async (_req, res) => {
      res.json(await storage.listLeads());
    }),
  );

  app.post(
    "/api/leads",
    asyncHandler(async (req, res) => {
      try {
        const input = createLeadRequestSchema.parse(req.body);

        if (input.stage) {
          const stages = await storage.listStageConfigs();
          if (!stages.some((s) => s.key === input.stage)) {
            return res.status(400).json({ error: "Unknown pipeline stage" });
          }
        }

        let personId: string;

        if ("person" in input) {
          const { person, ...leadInput } = input;
          const created = await storage.createLeadWithPerson(person, leadInput);
          personId = created.person.id;
        } else {
          const existingPerson = await storage.getPerson(input.personId);
          if (!existingPerson) return res.status(404).json({ error: "Person not found" });

          const existingLead = await storage.getLeadByPersonId(input.personId);
          if (existingLead) return res.status(409).json({ error: "This person is already in the pipeline" });

          await storage.createLead(input);
          personId = input.personId;
        }

        // Re-fetch so the response always has the same LeadWithPerson shape
        // (matching GET /api/leads) regardless of which path was taken.
        res.status(201).json(await storage.getLeadWithPersonByPersonId(personId));
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.patch(
    "/api/leads/:id",
    asyncHandler(async (req, res) => {
      try {
        const input = updateLeadSchema.parse(req.body);

        if (input.stage) {
          const stages = await storage.listStageConfigs();
          if (!stages.some((s) => s.key === input.stage)) {
            return res.status(400).json({ error: "Unknown pipeline stage" });
          }
        }

        const lead = await storage.updateLead(req.params.id, input);
        if (!lead) return res.status(404).json({ error: "Not found" });
        res.json(lead);
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.delete(
    "/api/leads/:id",
    asyncHandler(async (req, res) => {
      const deletePerson = req.query.deletePerson === "true";
      await storage.deleteLead(req.params.id, { deletePerson });
      res.status(204).end();
    }),
  );

  app.get(
    "/api/settings",
    asyncHandler(async (_req, res) => {
      res.json(await storage.getSettings());
    }),
  );

  app.patch(
    "/api/settings",
    asyncHandler(async (req, res) => {
      try {
        const input = updateSettingsSchema.parse(req.body);
        res.json(await storage.updateSettings(input));
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  // PUT so it can't collide with PATCH /api/stages/:key matching "order"
  // as a key value.
  app.put(
    "/api/stages/order",
    asyncHandler(async (req, res) => {
      try {
        const orderedKeys = reorderStagesSchema.parse(req.body);
        await storage.reorderStageConfigs(orderedKeys);
        res.json(await storage.listStageConfigs());
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.get(
    "/api/stages",
    asyncHandler(async (_req, res) => {
      res.json(await storage.listStageConfigs());
    }),
  );

  app.post(
    "/api/stages",
    asyncHandler(async (req, res) => {
      try {
        const input = insertStageConfigSchema.parse(req.body);
        res.status(201).json(await storage.createStageConfig(input));
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.patch(
    "/api/stages/:key",
    asyncHandler(async (req, res) => {
      try {
        const input = updateStageConfigSchema.parse(req.body);
        const stage = await storage.updateStageConfig(req.params.key, input);
        if (!stage) return res.status(404).json({ error: "Not found" });
        res.json(stage);
      } catch (err) {
        if (err instanceof ZodError) {
          return res.status(400).json({ error: fromZodError(err).message });
        }
        throw err;
      }
    }),
  );

  app.delete(
    "/api/stages/:key",
    asyncHandler(async (req, res) => {
      const result = await storage.deleteStageConfig(req.params.key);
      if (result.blocked) {
        return res.status(409).json({
          error: `${result.leadNames.length} lead${result.leadNames.length === 1 ? "" : "s"} still in this stage — move them first`,
          leadNames: result.leadNames,
        });
      }
      res.status(204).end();
    }),
  );
}
