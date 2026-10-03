// Ported from the Stitch export (agent_hive_mission_control/code.html). Keep visually identical to the design.
import { useEffect, useState } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { MissionControlHeader } from "./MissionControlHeader";
import { TaskInspector } from "./TaskInspector";

// TODO(PR 12): tasks come from the task API; the board below is the design's mock data.
export function TasksPage() {
  const [inspectorOpen, setInspectorOpen] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectorOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full">
        <MissionControlHeader />
        <div className="flex flex-1 min-h-[calc(100vh-14rem)] overflow-hidden">
          <KanbanBoard onSelectedTaskClick={() => setInspectorOpen((open) => !open)} />
          {inspectorOpen && <TaskInspector onClose={() => setInspectorOpen(false)} />}
        </div>
      </div>
    </main>
  );
}
