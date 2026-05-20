import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const ADMIN_SESSION_COOKIE = "moto_admin_session";
const SESSION_DAYS = 7;
const KEY_LENGTH = 64;

function getSecret() {
  const secret = process.env.ADMIN_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_AUTH_SECRET must be set in production.");
    }
    return "moto-admin-dev-secret";
  }
  return secret;
}

export type AdminSessionPayload = {
  sub: string;
  exp: number;
};

export type AdminUserSession = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, stored] = passwordHash.split(":");
  if (!salt || !stored) return false;

  const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  const left = Buffer.from(stored, "hex");
  const right = Buffer.from(derived, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createAdminSessionToken(adminId: string) {
  const payload: AdminSessionPayload = {
    sub: adminId,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as AdminSessionPayload;
    if (!payload?.sub || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSessionByToken(token?: string | null): Promise<AdminUserSession | null> {
  const payload = verifyAdminSessionToken(token);
  if (!payload) return null;

  const admin = await prisma.adminUser.findFirst({
    where: { id: payload.sub, isActive: true },
    select: { id: true, email: true, name: true, role: true },
  });

  return admin;
}

export async function requireAdmin(request: Request) {
  const token = parseCookieValue(request.headers.get("cookie"), ADMIN_SESSION_COOKIE);
  return getAdminSessionByToken(token);
}

export function parseCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function buildAdminCookieValue(adminId: string) {
  return createAdminSessionToken(adminId);
}
