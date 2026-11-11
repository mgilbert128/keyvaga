import { z } from "zod";
import { SELF_SERVE_ROLES } from "@/lib/auth/roles";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Use 128 characters or fewer."),
  intent: z.enum(SELF_SERVE_ROLES).default("GUEST"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type FormState =
  | {
      errors?: Partial<Record<"name" | "email" | "password" | "form", string[]>>;
      values?: { name?: string; email?: string };
    }
  | undefined;
