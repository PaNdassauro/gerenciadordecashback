"use server";

import { redirect } from "next/navigation";
import { validateCode, setAuthCookie, clearAuthCookie } from "@/lib/auth";

export type LoginResult = {
  success: boolean;
  error?: string;
};

export async function login(
  _prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const code = formData.get("code");

  if (!code || typeof code !== "string") {
    return { success: false, error: "Codigo de acesso obrigatorio" };
  }

  if (!validateCode(code.trim())) {
    return { success: false, error: "Codigo de acesso invalido" };
  }

  await setAuthCookie();
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearAuthCookie();
  redirect("/login");
}
