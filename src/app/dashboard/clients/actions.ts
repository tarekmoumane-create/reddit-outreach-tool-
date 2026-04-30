"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClientActionState = { error: string | null };

function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const extra_keywords = parseKeywords(
    String(formData.get("extra_keywords") ?? ""),
  );
  const active = formData.get("active") === "on";
  const thresholdRaw = Number(formData.get("score_threshold"));
  const score_threshold = Number.isFinite(thresholdRaw)
    ? Math.max(0, Math.min(100, Math.round(thresholdRaw)))
    : 60;
  const monthlyRaw = Number(formData.get("monthly_target"));
  const monthly_target = Number.isFinite(monthlyRaw)
    ? Math.max(0, Math.min(1000, Math.round(monthlyRaw)))
    : 150;
  const dailyRaw = Number(formData.get("daily_cap"));
  const daily_cap = Number.isFinite(dailyRaw)
    ? Math.max(0, Math.min(100, Math.round(dailyRaw)))
    : 10;

  if (!name) return { error: "Name is required." };
  if (!url) return { error: "URL is required." };

  if (id) {
    const { error } = await supabase
      .from("clients")
      .update({
        name,
        url,
        description,
        extra_keywords,
        active,
        score_threshold,
        monthly_target,
        daily_cap,
      })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name,
      url,
      description,
      extra_keywords,
      active,
      score_threshold,
      monthly_target,
      daily_cap,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function deleteClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
