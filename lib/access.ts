"use client";

import { createClient } from "@/lib/supabase/client";

export type AccessRole = "company" | "municipal";
export type DemoSession = { role: AccessRole; name: string; initials: string };

export const demoCredentials = {
  company: { email: "empresa@circularmuni.demo", password: "Empresa2026!" },
  municipal: { email: "operario@circularmuni.demo", password: "Operario2026!" },
} as const;

const demoSessionKey = "circularmuni-demo-session";

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(demoSessionKey) ?? "null") as DemoSession | null; }
  catch { return null; }
}

export function startDemoSession(role: AccessRole) {
  const session: DemoSession = role === "company"
    ? { role, name: "Carolina Muñoz", initials: "CM" }
    : { role, name: "Diego Rojas", initials: "DR" };
  localStorage.setItem(demoSessionKey, JSON.stringify(session));
  return session;
}

export async function getAccessRole(): Promise<AccessRole | null> {
  const demo = getDemoSession();
  if (demo) return demo.role;
  const client = createClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: membership } = await client.from("memberships").select("role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  return membership?.role === "municipal_admin" || membership?.role === "municipal_inspector" ? "municipal" : "company";
}

export async function endSession() {
  if (typeof window !== "undefined") localStorage.removeItem(demoSessionKey);
  const client = createClient();
  if (client) await client.auth.signOut();
}
