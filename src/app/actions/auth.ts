"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { defaultLandingFor, rolesForSignup, safeNextPath } from "@/lib/auth/roles";
import { isConfiguredAdmin } from "@/lib/auth/admin";
import type { Role } from "@/generated/prisma/enums";
import { loginSchema, signupSchema, type FormState } from "@/lib/validation/auth";
import { clearLimit, clientIp, hit, waitText } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email-verification";

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    intent: formData.get("intent") || undefined,
  });
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values };
  }

  const { name, email, password, intent } = parsed.data;
  const limit = await hit(`signup:ip:${await clientIp()}`, 5, 3600);
  if (!limit.ok) return { errors: { form: [`Too many new accounts from this network. Please try again in ${waitText(limit.retryAfterSeconds)}.`] }, values };
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { errors: { email: ["An account with this email already exists. Try logging in."] }, values };
  }

  const roles: Role[] = rolesForSignup(intent);
  if (isConfiguredAdmin(email)) roles.push("ADMIN");
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      roles: { create: roles.map((role) => ({ role })) },
    },
  });

  await sendVerificationEmail(user.id).catch((e) => console.error("verification email failed", e));
  await createSession(user.id);
  redirect(safeNextPath(String(formData.get("next") ?? "")) ?? defaultLandingFor(roles));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values };
  }

  const { email, password } = parsed.data;
  // Slow down password guessing: per account and per network.
  const [byEmail, byIp] = await Promise.all([hit(`login:email:${email}`, 8, 900), hit(`login:ip:${await clientIp()}`, 40, 900)]);
  if (!byEmail.ok || !byIp.ok) {
    const wait = waitText(Math.max(byEmail.ok ? 0 : byEmail.retryAfterSeconds, byIp.ok ? 0 : byIp.retryAfterSeconds));
    return { errors: { form: [`Too many login attempts. Please wait ${wait} and try again, or reset your password.`] }, values };
  }
  const user = await db.user.findUnique({ where: { email }, include: { roles: true } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : await burnPasswordCheck(password);
  if (!user || !ok) {
    return { errors: { form: ["That email and password don't match an account."] }, values };
  }

  await clearLimit(`login:email:${email}`);
  const roles = user.roles.map((r) => r.role);
  // Grant ADMIN to emails listed in ADMIN_EMAILS (e.g. the founder) on their next login.
  if (isConfiguredAdmin(user.email) && !roles.includes("ADMIN")) {
    await db.userRole.create({ data: { userId: user.id, role: "ADMIN" } });
    roles.push("ADMIN");
  }

  await createSession(user.id);
  redirect(safeNextPath(String(formData.get("next") ?? "")) ?? defaultLandingFor(roles));
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
