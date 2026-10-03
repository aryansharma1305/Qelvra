// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.
import { ActiveOperatives } from "./ActiveOperatives";
import { HomeHero } from "./HomeHero";
import { SwarmTelemetry } from "./SwarmTelemetry";
import { TeamActivity } from "./TeamActivity";

export function HomePage() {
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">
          <HomeHero />
          <ActiveOperatives />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-8">
            <TeamActivity />
            <SwarmTelemetry />
          </div>
        </div>
      </div>
    </main>
  );
}
