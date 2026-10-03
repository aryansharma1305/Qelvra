import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_DRAFT,
  TOOLS,
  TOTAL_STEPS,
  clampStep,
  providerLabel,
  temperatureLabel,
} from "../../apps/web/src/pages/create-agent/agentDraft";

describe("create agent wizard helpers", () => {
  it("clamps the step from the URL to a valid step", () => {
    expect(clampStep("3")).toBe(3);
    expect(clampStep(null)).toBe(1);
    expect(clampStep("0")).toBe(1);
    expect(clampStep(String(TOTAL_STEPS + 1))).toBe(1);
    expect(clampStep("2.5")).toBe(1);
    expect(clampStep("abc")).toBe(1);
  });

  it("describes temperature ranges", () => {
    expect(temperatureLabel(25)).toBe("0.25 (Deterministic Code Architecture)");
    expect(temperatureLabel(50)).toBe("0.50 (Balanced Reasoning)");
    expect(temperatureLabel(90)).toBe("0.90 (Creative Hypothesis Mode)");
  });

  it("defaults reproduce the design's state", () => {
    expect(DEFAULT_AGENT_DRAFT.name).toBe("Kite");
    expect(DEFAULT_AGENT_DRAFT.tools.size).toBe(6);
    expect(providerLabel(DEFAULT_AGENT_DRAFT.provider)).toBe("Ollama Local (RTX 4090)");
  });

  it("only enables known tools by default", () => {
    const known = new Set(TOOLS.map((tool) => tool.id));
    for (const id of DEFAULT_AGENT_DRAFT.tools) expect(known.has(id)).toBe(true);
  });
});
