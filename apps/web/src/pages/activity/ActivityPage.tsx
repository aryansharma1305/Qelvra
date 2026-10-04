import { useActivity } from "../../features/activity/use-activity";
import { TeamActivity } from "../home/TeamActivity";
export function ActivityPage() {
  const feed = useActivity();
  return (
    <main className="pt-12 min-h-screen bg-background">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
            Activity
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Follow your team's agents, tasks and messages.
          </p>
        </div>
        <TeamActivity feed={feed} full />
      </div>
    </main>
  );
}
