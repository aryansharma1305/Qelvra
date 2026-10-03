// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import type { KeyboardEvent } from "react";
import { useAgentDraft } from "./agentDraftContext";

const AVATAR_ON =
  "avatar-option cursor-pointer p-3 rounded-xl bg-surface-container flex flex-col items-center gap-2 group transition-all";
const AVATAR_OFF =
  "avatar-option cursor-pointer p-3 rounded-xl bg-surface-container-lowest flex flex-col items-center gap-2 group transition-all hover:bg-surface-container";

export function StepIdentity({ active }: { active: boolean }) {
  const { draft, update } = useAgentDraft();
  const avatarProps = (index: number) => ({
    role: "radio",
    tabIndex: 0,
    "aria-checked": draft.avatar === index,
    onClick: () => update({ avatar: index }),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        update({ avatar: index });
      }
    },
  });
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-1"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {"Operative Identity & Designation"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Designate the digital teammate's cognitive persona, alias, and operational role in
              your mesh.
            </p>
          </div>
          <span className="font-label-sm text-label-sm px-2.5 py-1 rounded bg-surface-container-high text-primary font-mono">
            OP-ID #07
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface flex items-center justify-between">
              <span>Agent Alias / Name</span>
              <span className="font-code-sm text-code-sm text-secondary font-mono">REQUIRED</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                terminal
              </span>
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface-container rounded-lg text-on-surface font-body-md text-body-md focus:bg-surface-container-high outline-none transition-all placeholder:text-outline"
                id="input-agent-name"
                placeholder="e.g. Kite, Aura, Sentinel"
                type="text"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface flex items-center justify-between">
              <span>{"Operational Role & Tier"}</span>
              <span className="font-code-sm text-code-sm text-outline font-mono">L6 TIER</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                badge
              </span>
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface-container rounded-lg text-on-surface font-body-md text-body-md focus:bg-surface-container-high outline-none transition-all placeholder:text-outline"
                id="input-agent-role"
                placeholder="e.g. Kernel Compiler, SRE Lead"
                type="text"
                value={draft.role}
                onChange={(event) => update({ role: event.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="font-label-md text-label-md text-on-surface">
              Neural Operative Signature Avatar
            </label>
            <button
              className="flex items-center gap-1.5 font-code-sm text-code-sm text-primary hover:text-primary-fixed transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>Generate Custom Vector Avatar</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={draft.avatar === 0 ? AVATAR_ON : AVATAR_OFF} {...avatarProps(0)}>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden shadow-inner">
                <svg
                  className="w-10 h-10 text-primary transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <polygon
                    points="12 2 2 7 12 12 22 7 12 2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />{" "}
                  <polyline
                    points="2 17 12 22 22 17"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />{" "}
                  <polyline
                    points="2 12 12 17 22 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />{" "}
                </svg>
              </div>
              <span className="font-code-sm text-code-sm text-on-surface font-medium">
                Lattice Prism
              </span>
              {draft.avatar === 0 ? (
                <span className="font-label-sm text-label-sm text-primary uppercase">Active</span>
              ) : (
                <span className="font-label-sm text-label-sm text-outline uppercase">Select</span>
              )}
            </div>
            <div className={draft.avatar === 1 ? AVATAR_ON : AVATAR_OFF} {...avatarProps(1)}>
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center relative overflow-hidden">
                <svg
                  className="w-10 h-10 text-secondary transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <circle cx="12" cy="12" r="9" /> <circle cx="12" cy="12" r="5" />{" "}
                  <line x1="12" x2="12" y1="3" y2="7" />{" "}
                  <line x1="12" x2="12" y1="17" y2="21" />{" "}
                </svg>
              </div>
              <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">
                Orbital Gyro
              </span>
              {draft.avatar === 1 ? (
                <span className="font-label-sm text-label-sm text-primary uppercase">Active</span>
              ) : (
                <span className="font-label-sm text-label-sm text-outline uppercase">Select</span>
              )}
            </div>
            <div className={draft.avatar === 2 ? AVATAR_ON : AVATAR_OFF} {...avatarProps(2)}>
              <div className="w-14 h-14 rounded-full bg-tertiary/10 flex items-center justify-center relative overflow-hidden">
                <svg
                  className="w-10 h-10 text-tertiary transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <path d="M12 2L2 19h20L12 2z" /> <circle cx="12" cy="13" r="2.5" />{" "}
                </svg>
              </div>
              <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">
                Delta Core
              </span>
              {draft.avatar === 2 ? (
                <span className="font-label-sm text-label-sm text-primary uppercase">Active</span>
              ) : (
                <span className="font-label-sm text-label-sm text-outline uppercase">Select</span>
              )}
            </div>
            <div className={draft.avatar === 3 ? AVATAR_ON : AVATAR_OFF} {...avatarProps(3)}>
              <div className="w-14 h-14 rounded-full bg-primary-container/20 flex items-center justify-center relative overflow-hidden">
                <svg
                  className="w-10 h-10 text-primary-fixed transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <polygon points="12 2 19 8.5 19 15.5 12 22 5 15.5 5 8.5 12 2" />{" "}
                </svg>
              </div>
              <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">
                Hex Lattice
              </span>
              {draft.avatar === 3 ? (
                <span className="font-label-sm text-label-sm text-primary uppercase">Active</span>
              ) : (
                <span className="font-label-sm text-label-sm text-outline uppercase">Select</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-label-md text-on-surface">
            {"Teammate Synopsis & Specialty"}
          </label>
          <textarea
            className="w-full p-3 bg-surface-container rounded-lg text-on-surface font-body-md text-body-md focus:bg-surface-container-high outline-none transition-all placeholder:text-outline"
            id="input-agent-bio"
            placeholder="Brief high-throughput role mission statement..."
            rows={3}
            defaultValue={
              "Autonomous kernel-level compiler and multi-repo orchestration specialist with zero-downtime canary rollout heuristics."
            }
          />
        </div>
      </div>
    </section>
  );
}
