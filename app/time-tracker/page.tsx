import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import TimeTrackerClient from "./time-tracker-client";

export default async function TimeTrackerPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const sessionId = session.user.id;

  const { data: timeEntries } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", sessionId)
    .order("created_at", { ascending: false });

  return <TimeTrackerClient userId={sessionId} initialEntries={timeEntries ?? []} />;
}
