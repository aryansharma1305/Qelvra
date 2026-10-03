// Ported from the Stitch export (agent_hive_onboarding_choose_ai_engines/code.html). Keep visually identical to the design.

import type { KeyboardEvent } from "react";

const RADIO_ON =
  "w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary radio-indicator";
const RADIO_OFF =
  "w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-transparent radio-indicator";

interface ComputeSelectorProps {
  selected: number;
  onSelect: (index: number) => void;
}

export function ComputeSelector({ selected, onSelect }: ComputeSelectorProps) {
  const radioClass = (index: number) => (selected === index ? RADIO_ON : RADIO_OFF);
  const cardProps = (index: number) => ({
    role: "radio",
    tabIndex: 0,
    "aria-checked": selected === index,
    onClick: () => onSelect(index),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(index);
      }
    },
  });

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-3 gap-gutter-lg"
      id="compute-selector-grid"
      role="radiogroup"
      aria-label="Compute engine"
    >
      <div
        className={`group relative rounded-xl bg-surface-container-low hover:bg-surface-container p-space-lg flex flex-col justify-between gap-space-xl cursor-pointer transition-all duration-200 shadow-lg compute-card${selected === 0 ? " active-card" : ""}`}
        {...cardProps(0)}
        data-engine-type="local"
      >
        <div className="absolute top-4 right-4">
          <div className={radioClass(0)}>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </div>
        </div>
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined">developer_board</span>
            </div>
            <div>
              <span className="font-label-sm text-label-sm uppercase text-secondary">
                Offline Sovereign
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Local Engine (Recommended)
              </h2>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Ollama, vLLM, LM Studio, or llama.cpp. Executes entirely on host metal without external
            packet broadcast.
          </p>
          <div className="rounded-lg bg-surface-container-lowest p-space-md flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">Detected Hardware</span>
              <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-1">
                <span>Active</span>
                <span className="material-symbols-outlined text-[14px]">verified</span>
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface font-medium truncate">
              NVIDIA GeForce RTX 4090 (24GB VRAM) detected ✓
            </span>
          </div>
          <div className="relative w-full h-36 rounded-lg bg-surface-container-lowest overflow-hidden flex flex-col justify-end p-space-md">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#4cd7f6_1px,transparent_1px)] [background-size:12px_12px]" />
            <div className="relative z-10 flex items-end justify-between gap-1 w-full h-20">
              <div className="flex-1 bg-secondary/20 rounded-t h-[45%] flex items-end justify-center pb-1">
                <span className="font-code-sm text-[9px] text-secondary">3.4B</span>
              </div>
              <div className="flex-1 bg-secondary/30 rounded-t h-[65%] flex items-end justify-center pb-1">
                <span className="font-code-sm text-[9px] text-secondary">7B</span>
              </div>
              <div className="flex-1 bg-secondary/40 rounded-t h-[80%] flex items-end justify-center pb-1">
                <span className="font-code-sm text-[9px] text-secondary">14B</span>
              </div>
              <div className="flex-1 bg-secondary rounded-t h-[95%] flex items-end justify-center pb-1 shadow-[0_0_12px_rgba(76,215,246,0.3)]">
                <span className="font-code-sm text-[9px] text-on-secondary font-bold">32B</span>
              </div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[30%] flex items-end justify-center pb-1">
                <span className="font-code-sm text-[9px] text-outline">70B</span>
              </div>
            </div>
            <div className="relative z-10 flex justify-between items-center pt-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Throughput Cap
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-semibold">
                124.6 tok/s
              </span>
            </div>
          </div>
        </div>
        <div className="pt-space-md bg-surface-container-high/30 -mx-space-lg -mb-space-lg px-space-lg pb-space-lg rounded-b-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Operating Cost
            </span>
            <span className="font-code-md text-code-md text-tertiary font-medium">
              $0.00 / month
            </span>
          </div>
          <span className="px-space-sm py-1 rounded bg-surface-container-highest text-on-surface font-code-sm text-code-sm">
            GGUF / EXL2
          </span>
        </div>
      </div>
      <div
        className={`group relative rounded-xl bg-surface-container-low hover:bg-surface-container p-space-lg flex flex-col justify-between gap-space-xl cursor-pointer transition-all duration-200 shadow-lg compute-card${selected === 1 ? " active-card" : ""}`}
        {...cardProps(1)}
        data-engine-type="cloud"
      >
        <div className="absolute top-4 right-4">
          <div className={radioClass(1)}>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </div>
        </div>
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">cloud_sync</span>
            </div>
            <div>
              <span className="font-label-sm text-label-sm uppercase text-primary">
                Frontier Intelligence
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Cloud Reasoning</h2>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Anthropic Claude 3.7 Sonnet, OpenAI o3-mini / GPT-4o, Google Gemini 2.5 Pro. Ultra-high
            context and deep mathematical reasoning via your own API keys.
          </p>
          <div className="rounded-lg bg-surface-container-lowest p-space-md flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">Supported Models</span>
              <span className="font-code-sm text-code-sm text-primary">BYOK Keyvault</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface font-medium truncate">
              Claude 3.7 • o3-mini • Gemini 2.5 Pro
            </span>
          </div>
          <div className="relative w-full h-36 rounded-lg bg-surface-container-lowest overflow-hidden flex flex-col justify-between p-space-md">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Context Envelope
              </span>
              <span className="font-code-sm text-code-sm text-primary font-medium">
                Up to 2,000,000 tokens
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: "88%" }} />
            </div>
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="font-code-sm text-[10px]">Zero Persistence Enforced</span>
              <span className="font-code-sm text-[10px] text-tertiary">TLS 1.3 Strict</span>
            </div>
          </div>
        </div>
        <div className="pt-space-md bg-surface-container-high/30 -mx-space-lg -mb-space-lg px-space-lg pb-space-lg rounded-b-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Operating Cost
            </span>
            <span className="font-code-md text-code-md text-on-surface font-medium">
              Direct Provider Billing
            </span>
          </div>
          <span className="px-space-sm py-1 rounded bg-surface-container-highest text-on-surface font-code-sm text-code-sm">
            HTTPS Rest API
          </span>
        </div>
      </div>
      <div
        className={`group relative rounded-xl bg-surface-container-low hover:bg-surface-container p-space-lg flex flex-col justify-between gap-space-xl cursor-pointer transition-all duration-200 shadow-lg compute-card${selected === 2 ? " active-card" : ""}`}
        {...cardProps(2)}
        data-engine-type="hybrid"
      >
        <div className="absolute top-4 right-4">
          <div className={radioClass(2)}>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </div>
        </div>
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined">hub</span>
            </div>
            <div>
              <span className="font-label-sm text-label-sm uppercase text-tertiary">
                Custom Mesh
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {"Hybrid CLI & Custom Endpoints"}
              </h2>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Custom OpenAI-compatible endpoints, corporate private VPC, or local llama-server
            binaries running under custom orchestrators.
          </p>
          <div className="rounded-lg bg-surface-container-lowest p-space-md flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">Target Architecture</span>
              <span className="font-code-sm text-code-sm text-secondary">Manual Daemon</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface font-medium truncate">
              http://internal-vpc.local:8080/v1
            </span>
          </div>
          <div className="relative w-full h-36 rounded-lg bg-surface-container-lowest p-space-md font-code-sm text-[11px] flex flex-col justify-between">
            <div className="text-outline-variant flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span>Proxy Gateway Stream</span>
            </div>
            <div className="text-on-surface-variant space-y-1">
              <div className="truncate text-secondary">{"> CONNECT vpc-ai-gateway:8443"}</div>
              <div className="truncate text-outline">{"> AUTH: Bearer hive_sk_****"}</div>
              <div className="truncate text-tertiary">{"> STATUS 200 OK (latency 12ms)"}</div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-outline">Failover Nodes: 2</span>
              <span className="text-secondary font-semibold">Custom Routing</span>
            </div>
          </div>
        </div>
        <div className="pt-space-md bg-surface-container-high/30 -mx-space-lg -mb-space-lg px-space-lg pb-space-lg rounded-b-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Operating Cost
            </span>
            <span className="font-code-md text-code-md text-on-surface font-medium">
              Self-Hosted Infra
            </span>
          </div>
          <span className="px-space-sm py-1 rounded bg-surface-container-highest text-on-surface font-code-sm text-code-sm">
            OpenAI Compatible
          </span>
        </div>
      </div>
    </div>
  );
}
