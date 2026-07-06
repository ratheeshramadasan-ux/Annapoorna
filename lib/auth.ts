import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRuntimeEnv, requireDb } from "./db";
import type { Customer } from "./types";

const ADMIN_COOKIE = "annapoorna_admin_session";
const CUSTOMER_COOKIE = "annapoorna_customer_session";

type SessionPayload = {
  id: number;
  email?: string | null;
  exp: number;
};

function base64Url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return atob(padded);
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return base64Url(signature);
}

async function sessionSecret() {
  const env = await getRuntimeEnv();
  return (
    env.ANNAPOORNA_SESSION_SECRET ??
    env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ??
    env.ANNAPOORNA_ADMIN_PASSCODE ??
    "annapoorna-local-dev-secret"
  );
}

async function createToken(payload: SessionPayload) {
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${await sign(body, await sessionSecret())}`;
}

async function verifyToken(token?: string) {
  if (!token) {
    return null;
  }
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }
  const expected = await sign(body, await sessionSecret());
  if (signature !== expected) {
    return null;
  }
  const payload = JSON.parse(fromBase64Url(body)) as SessionPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export async function setAdminSession(admin: { id: number; email: string | null }) {
  const cookieStore = await cookies();
  const token = await createToken({
    id: admin.id,
    email: admin.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const payload = await verifyToken(cookieStore.get(ADMIN_COOKIE)?.value);
  if (!payload) {
    return null;
  }
  const db = await requireDb();
  return db
    .prepare(
      "SELECT id, email, name, role FROM admin_users WHERE id = ? AND status = 'approved'",
    )
    .bind(payload.id)
    .first<{ id: number; email: string; name: string | null; role: string }>();
}

export async function requireAdminSession() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/admin");
  }
  return admin;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function setCustomerSession(customer: Customer) {
  const cookieStore = await cookies();
  const token = await createToken({
    id: customer.id,
    email: customer.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  cookieStore.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getCustomerSession() {
  const cookieStore = await cookies();
  const payload = await verifyToken(cookieStore.get(CUSTOMER_COOKIE)?.value);
  if (!payload) {
    return null;
  }
  const db = await requireDb();
  return db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .bind(payload.id)
    .first<Customer>();
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_COOKIE);
}
