"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { defaultLandingFor, rolesForSignup, safeNextPath } from "@/lib/auth/roles";
import { isConfiguredAdmin } from "@/lib/auth/admin";
import type { Role } from "@/generated/prisma/enums";
import { loginSchema, signupSchema, type FormState } from "@/lib/validation/auth";

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
  const user = await db.user.findUnique({ where: { email }, include: { roles: true } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : await burnPasswordCheck(password);
  if (!user || !ok) {
    return { errors: { form: ["That email and password don't match an account."] }, values };
  }

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
