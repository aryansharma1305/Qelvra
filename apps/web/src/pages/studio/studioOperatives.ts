// Operative details from the Stitch AI Studio design (its inline script's data).
// TODO(PR 15): derive from registered agents once the studio shows live state.
export const STUDIO_OPERATIVES = {
  nova: { name: "Nova", role: "Frontend Systems", desk: "Desk #02 (Engineering Bay, Rig Alpha)" },
  michael: { name: "Michael", role: "Lead Architect", desk: "Central Glass Command Podium" },
  atlas: {
    name: "Atlas",
    role: "Distributed Backend",
    desk: "Desk #03 (Engineering Bay, Rig Beta)",
  },
  scout: { name: "Scout", role: "QA & Security Fuzz", desk: "Desk #05 (Security War Room)" },
  pixel: {
    name: "Pixel",
    role: "Design Technologist",
    desk: "Drafting Light Table (Creative Atelier)",
  },
  echo: { name: "Echo", role: "Deep Knowledge Vault", desk: "Soundproof Reasoning Pod #01" },
} as const;

export type OperativeKey = keyof typeof STUDIO_OPERATIVES;

export const ZOOM_MIN = 60;
export const ZOOM_MAX = 160;
export const ZOOM_DEFAULT = 100;

export function clampZoom(value: number): number {
  return Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX);
}

export type StudioView = "studio" | "command";
export type Perspective = "iso" | "ortho";
