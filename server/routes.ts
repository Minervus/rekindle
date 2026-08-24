import type { Express, RequestHandler } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertPersonSchema,
  updatePersonSchema,
  insertInteractionSchema,
  updateInteractionSchema,
  loginSchema,
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
}
