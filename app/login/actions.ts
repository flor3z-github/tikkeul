"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function sanitizeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  const cooldown = message.match(/after (\d+) seconds?/i);
  if (cooldown) {
    return `보안을 위해 ${cooldown[1]}초 뒤에 다시 시도해주세요.`;
  }
  if (m.includes("email rate limit") || m.includes("rate limit exceeded")) {
    return "이메일 전송 한도를 초과했어요. 잠시 후 다시 시도해주세요.";
  }
  if (m.includes("user already registered")) {
    return "이미 가입된 이메일이에요. 로그인 해주세요.";
  }
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (m.includes("email not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해주세요.";
  }
  if (m.includes("password should be at least")) {
    return "비밀번호는 6자 이상이어야 해요.";
  }
  if (m.includes("unable to validate email address")) {
    return "올바른 이메일 형식이 아니에요.";
  }
  return message;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = sanitizeRedirect(formData.get("redirectTo"));

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("이메일과 비밀번호를 입력해주세요.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("이메일과 비밀번호를 입력해주세요.")}`);
  }
  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("비밀번호는 6자 이상이어야 해요.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  // If "Confirm email" is enabled in Supabase, session is null and the user
  // must verify via email before they can sign in.
  if (!data.session) {
    redirect(
      `/login?info=${encodeURIComponent("가입 메일을 확인한 뒤 로그인해주세요.")}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
