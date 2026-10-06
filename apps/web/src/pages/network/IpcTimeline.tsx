// Ported from the Stitch export (agent_hive_agent_network/code.html). Keep visually identical to the design.

export function IpcTimeline() {
  return (
    <section className="w-full bg-surface-container-lowest p-margin flex flex-col gap-space-sm z-30">
      <div className="flex items-center justify-between flex-wrap gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {"Swarm IPC Stream & Message Timeline"}
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-outline">
            Not available yet
          </span>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="relative">
            <input
              className="h-7 w-48 pl-7 pr-2 rounded bg-surface-container text-code-sm font-code-sm text-on-surface placeholder:text-outline focus:outline-none focus:w-64 transition-all"
              placeholder="Filter IPC payload..."
              type="text"
            />{" "}
            <span className="material-symbols-outlined absolute left-1.5 top-1 text-[14px] text-outline">
              search
            </span>
          </div>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="pause — coming later"
            className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">pause</span>
            <span>PAUSE</span>
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="delete sweep — coming later"
            className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
            <span>CLEAR</span>
          </button>
        </div>
      </div>
      <div className="w-full bg-surface-container rounded-lg overflow-x-auto">
        <table className="w-full text-left font-code-sm text-code-sm">
          <thead>
            <tr className="bg-surface-container-high text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <th className="py-1.5 px-3">TIMESTAMP</th>
              <th className="py-1.5 px-3">SENDER</th>
              <th className="py-1.5 px-3">TARGET</th>
              <th className="py-1.5 px-3">PAYLOAD TYPE</th>
              <th className="py-1.5 px-3">MESSAGE CONTENT / DAG STATE</th>
              <th className="py-1.5 px-3 text-right">LATENCY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-transparent">
            <tr className="hover:bg-surface-container-high/60 transition-colors">
              <td className="py-2 px-3 text-outline">Not measured</td>
              <td className="py-2 px-3 font-medium text-primary">Michael (OP-00)</td>
              <td className="py-2 px-3 text-secondary">Nova (OP-01)</td>
              <td className="py-2 px-3">
                {" "}
                <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-sm text-label-sm">
                  AST_DIFF
                </span>{" "}
              </td>
              <td className="py-2 px-3 text-on-surface-variant truncate max-w-md">
                {" "}
                "Commit AST transformation patch #442 for component AgentNetworkCanvas.vue"{" "}
              </td>
              <td className="py-2 px-3 text-right text-tertiary">Not measured</td>
            </tr>
            <tr className="hover:bg-surface-container-high/60 transition-colors">
              <td className="py-2 px-3 text-outline">Not measured</td>
              <td className="py-2 px-3 font-medium text-secondary">Nova (OP-01)</td>
              <td className="py-2 px-3 text-tertiary">Scout (OP-05)</td>
              <td className="py-2 px-3">
                {" "}
                <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-tertiary font-label-sm text-label-sm">
                  TEST_TRACE
                </span>{" "}
              </td>
              <td className="py-2 px-3 text-on-surface-variant truncate max-w-md">
                {" "}
                "Initiate visual regression diff check for [data-agent-ring=active] on 2x DPR
                screens"{" "}
              </td>
              <td className="py-2 px-3 text-right text-tertiary">Not measured</td>
            </tr>
            <tr className="hover:bg-surface-container-high/60 transition-colors">
              <td className="py-2 px-3 text-outline">Not measured</td>
              <td className="py-2 px-3 font-medium text-primary">Michael (OP-00)</td>
              <td className="py-2 px-3 text-primary-fixed-dim">Atlas (OP-03)</td>
              <td className="py-2 px-3">
                {" "}
                <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                  JSON_SCHEMA
                </span>{" "}
              </td>
              <td className="py-2 px-3 text-on-surface-variant truncate max-w-md">
                {" "}
                "Lock Redis session pipeline lease for agent thread OP-01-T04"{" "}
              </td>
              <td className="py-2 px-3 text-right text-tertiary">Not measured</td>
            </tr>
            <tr className="hover:bg-surface-container-high/60 transition-colors">
              <td className="py-2 px-3 text-outline">Not measured</td>
              <td className="py-2 px-3 font-medium text-primary-container">Pixel (OP-04)</td>
              <td className="py-2 px-3 text-secondary">Nova (OP-01)</td>
              <td className="py-2 px-3">
                {" "}
                <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-primary-container font-label-sm text-label-sm">
                  TOKEN_UPDATE
                </span>{" "}
              </td>
              <td className="py-2 px-3 text-on-surface-variant truncate max-w-md">
                {" "}
                "Obsidian theme hex tokens synchronized: --surface-container: #201f22"{" "}
              </td>
              <td className="py-2 px-3 text-right text-tertiary">Not measured</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
