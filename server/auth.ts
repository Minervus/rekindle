import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { RequestHandler } from "express";

const JWT_EXPIRY = "90d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return secret;
}

export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const hash = process.env.AUTH_PASSPHRASE_HASH;
  if (!hash) throw new Error("AUTH_PASSPHRASE_HASH is not set.");
  return bcrypt.compare(passphrase, hash);
}

export function issueToken(): string {
  return jwt.sign({ sub: "owner" }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
