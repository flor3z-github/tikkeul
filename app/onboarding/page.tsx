import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./_components/onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [settingsRes, profileRes] = await Promise.all([
    supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Already configured (a settings row exists) → skip onboarding entirely.
  // This guards both a manual /onboarding visit and the post-completion state,
  // so a returning user is never stuck on this screen.
  if (settingsRes.data) redirect("/dashboard");

  return (
    <OnboardingFlow initialNickname={profileRes.data?.display_name ?? ""} />
  );
}
