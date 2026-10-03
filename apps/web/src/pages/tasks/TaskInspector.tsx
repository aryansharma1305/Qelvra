// Ported from the Stitch export (agent_hive_mission_control/code.html). Keep visually identical to the design.

export function TaskInspector({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="w-[480px] flex-shrink-0 border-l border-outline-variant/30 bg-surface-container-lowest flex flex-col justify-between overflow-y-auto custom-scrollbar"
      id="inspector-drawer"
    >
      <div className="p-5 border-b border-outline-variant/20 bg-surface-container-low/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-code-sm text-code-sm text-secondary font-semibold">
              #TSK-8924
            </span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-error-container/30 text-error border border-error/30 uppercase font-semibold">
              High Priority
            </span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Working • 72%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors"
              title="Copy Deep Link"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">link</span>{" "}
            </button>
            <button
              className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors"
              title="Full screen"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>{" "}
            </button>
            <button
              className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors"
              title="Close Drawer (ESC)"
              type="button"
              onClick={onClose}
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">close</span>{" "}
            </button>
          </div>
        </div>
        <h2 className="font-headline-md text-headline-md font-semibold text-on-surface leading-tight">
          {"Implement Login API & WebAuthn Session Bridge"}
        </h2>
        <div className="mt-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-container to-secondary flex items-center justify-center text-on-primary font-bold font-code-sm">
                AT
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-tertiary border-2 border-surface-container-low" />
            </div>
            <div className="flex flex-col">
              <span className="font-body-md text-body-md font-medium text-on-surface flex items-center gap-1.5">
                Atlas
                <span className="font-label-sm text-label-sm px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                  Lead Agent
                </span>
              </span>
              <span className="font-code-sm text-code-sm text-outline">
                Distributed Backend Specialist • GPT-4o
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-label-sm text-label-sm text-outline">ELAPSED RUN</div>
            <div className="font-code-sm text-code-sm text-secondary font-semibold">18m 45s</div>
          </div>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Autonomous Mission Spec
          </span>
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Construct deterministic authentication pipeline handling FIDO2 WebAuthn credential
            attestation with fallback to RS256 JWT rotation. Store live session tokens inside Redis
            cluster with automatic 15-minute sliding TTL and IP binding.
          </div>
        </div>
        <MilestonesSection />
        <PtyTelemetrySection />
        <InterAgentCommsSection />
        <ChangedArtifactsSection />
        <DagChainSection />
      </div>
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low/70 flex items-center justify-between gap-3">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30 font-body-sm text-body-sm transition-all">
          <span className="material-symbols-outlined text-[16px]">pause</span>
          <span>Halt Agent</span>
        </button>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 font-body-sm text-body-sm transition-all">
            <span className="material-symbols-outlined text-[16px]">fork_right</span>
            <span>Spawn Sub-Task</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary-container shadow-[0_0_16px_rgba(208,188,255,0.3)] transition-all">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Request Review</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function MilestonesSection() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
          Execution Milestones
        </span>
        <span className="font-code-sm text-code-sm text-tertiary font-medium">4 / 5 Complete</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-container-low transition-colors cursor-pointer group">
          <input
            defaultChecked
            className="w-4 h-4 rounded bg-surface-container-high border-outline-variant text-primary focus:ring-0 accent-primary"
            type="checkbox"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant line-through group-hover:text-on-surface">
            {"Generate Redis schema & sliding window key space"}
          </span>
          <span className="font-code-sm text-[10px] text-tertiary ml-auto">PASS</span>
        </label>
        <label className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-container-low transition-colors cursor-pointer group">
          <input
            defaultChecked
            className="w-4 h-4 rounded bg-surface-container-high border-outline-variant text-primary focus:ring-0 accent-primary"
            type="checkbox"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant line-through group-hover:text-on-surface">
            Inject WebAuthn challenge verification middleware
          </span>
          <span className="font-code-sm text-[10px] text-tertiary ml-auto">PASS</span>
        </label>
        <label className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-container-low transition-colors cursor-pointer group">
          <input
            defaultChecked
            className="w-4 h-4 rounded bg-surface-container-high border-outline-variant text-primary focus:ring-0 accent-primary"
            type="checkbox"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant line-through group-hover:text-on-surface">
            Enforce standard RFC-7519 JWT payload claims
          </span>
          <span className="font-code-sm text-[10px] text-tertiary ml-auto">PASS</span>
        </label>
        <label className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-container-low transition-colors cursor-pointer group">
          <input
            defaultChecked
            className="w-4 h-4 rounded bg-surface-container-high border-outline-variant text-primary focus:ring-0 accent-primary"
            type="checkbox"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant line-through group-hover:text-on-surface">
            Cross-verify passkey response in Safari 17.4 shim
          </span>
          <span className="font-code-sm text-[10px] text-tertiary ml-auto">PASS</span>
        </label>
        <label className="flex items-center gap-2.5 p-2 rounded bg-surface-container-low border border-secondary/30 transition-colors cursor-pointer group">
          <input
            className="w-4 h-4 rounded bg-surface-container-high border-secondary text-primary focus:ring-0 accent-secondary"
            type="checkbox"
          />
          <span className="font-body-sm text-body-sm font-medium text-secondary">
            {"Export TS types & client authentication hook"}
          </span>
          <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-secondary/15 text-secondary ml-auto animate-pulse">
            Running
          </span>
        </label>
      </div>
    </div>
  );
}

export function PtyTelemetrySection() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-secondary">terminal</span>
          Agent Atlas PTY Telemetry Stream
        </span>
        <span className="font-code-sm text-code-sm text-outline">ttyS0 • 42ms</span>
      </div>
      <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 font-code-sm text-code-sm text-on-surface-variant flex flex-col gap-1 overflow-x-auto shadow-inner">
        <div className="flex items-center gap-2 text-outline">
          <span>18:14:02.109</span>
          <span className="text-primary">[atlas/auth]</span>
          <span>Loaded private key JWK from vault: key_id=k-9082</span>
        </div>
        <div className="flex items-center gap-2 text-outline">
          <span>18:14:05.421</span>
          <span className="text-secondary">[atlas/redis]</span>
          <span>Connected to cluster redis://10.0.4.12:6379 (pool=8)</span>
        </div>
        <div className="flex items-center gap-2 text-outline">
          <span>18:14:11.890</span>
          <span className="text-tertiary">[scout/test]</span>
          <span>✓ test_webauthn_registration_flow (42ms)</span>
        </div>
        <div className="flex items-center gap-2 text-outline">
          <span>18:14:12.015</span>
          <span className="text-tertiary">[scout/test]</span>
          <span>✓ test_jwt_sliding_refresh_token (14ms)</span>
        </div>
        <div className="flex items-center gap-2 text-on-surface bg-surface-container/50 px-1 py-0.5 rounded">
          <span className="text-secondary animate-pulse">▶</span>
          <span className="text-primary font-medium">[atlas/codegen]</span>
          <span className="text-on-surface">Writing artifacts into src/auth/client-hook.ts...</span>
        </div>
      </div>
    </div>
  );
}

export function InterAgentCommsSection() {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline flex items-center justify-between">
        <span>Swarm Inter-Agent Comms</span>
        <span className="text-outline font-mono">3 transmissions</span>
      </span>
      <div className="flex flex-col gap-2">
        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm font-semibold text-primary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Atlas (Backend)
            </span>
            <span className="font-label-sm text-label-sm text-outline">18:12 UTC</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface">
            "I have anchored the Redis token bucket rate limiter. Scout, can you verify the test
            fixtures on Safari WebKit?"
          </p>
        </div>
        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Scout (QA Attestor)
            </span>
            <span className="font-label-sm text-label-sm text-outline">18:13 UTC</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface">
            "Running WebKit passkey simulation. Found 2 assertions requiring
            `navigator.credentials.create` shim. Patched and passed."
          </p>
        </div>
        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm font-semibold text-secondary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Nova (Frontend)
            </span>
            <span className="font-label-sm text-label-sm text-outline">18:14 UTC</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface">
            "Awaiting client hook export. Once merged, I will plug it directly into the mobile nav
            auth state."
          </p>
        </div>
      </div>
    </div>
  );
}

export function ChangedArtifactsSection() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
          Changed Artifacts (2 Files)
        </span>
        <span className="font-code-sm text-code-sm text-tertiary">+126 / -17 lines</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="p-2 rounded bg-surface-container-low border border-outline-variant/20 flex items-center justify-between font-code-sm text-code-sm">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-[15px] text-secondary">
              description
            </span>
            <span>src/auth/session.ts</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
            <span className="text-tertiary">+84</span>
            <span className="text-error">-12</span>
          </div>
        </div>
        <div className="p-2 rounded bg-surface-container-low border border-outline-variant/20 flex items-center justify-between font-code-sm text-code-sm">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-[15px] text-secondary">
              description
            </span>
            <span>src/middleware/jwt.ts</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
            <span className="text-tertiary">+42</span>
            <span className="text-error">-5</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DagChainSection() {
  return (
    <div className="flex flex-col gap-2 pb-6">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
        DAG Chain Context
      </span>
      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center justify-between text-outline font-label-sm text-label-sm">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-tertiary">check_circle</span>
          <span className="text-on-surface">#TSK-8915 Auth0 Schema</span>
        </div>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        <div className="flex items-center gap-1.5 font-medium text-secondary">
          <span>#TSK-8924 Login API</span>
        </div>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        <div className="flex items-center gap-1.5 text-outline">
          <span>#TSK-8925 Nova Nav</span>
        </div>
      </div>
    </div>
  );
}
