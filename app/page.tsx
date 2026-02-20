import { Separator } from "@/components/ui/separator";
import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { createServerSupabaseClient } from "@/lib/server-utils";
import TimeTrackerReadOnly from "./time-tracker-readonly";

export default async function Home() {
  const supabase = createServerSupabaseClient();

  // Fetch all time entries for public view
  const { data: allTimeEntries, error } = await supabase
    .from("time_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching entries:", error);
  }

  console.log("Fetched entries count:", allTimeEntries?.length ?? 0);

  return (
    <>
      <TypographyH2>
        What did Emilie <span className="text-green-400">do today??</span>
      </TypographyH2>
      <TypographyP>What I did today</TypographyP>
      <TypographyP>Log in is for me to edit</TypographyP>
      <Separator className="my-4" />

      {/* Read-only chart and entries */}
      <TimeTrackerReadOnly entries={allTimeEntries ?? []} />

      <Separator className="my-4" />
      <TypographyP>hi</TypographyP>
    </>
  );
}
