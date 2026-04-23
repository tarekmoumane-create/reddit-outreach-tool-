import { createClient } from "@supabase/supabase-js";

// Service-role client used ONLY by server-side code (cron workers, server
// actions that must bypass RLS). Never import this from a Client Component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
