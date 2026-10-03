export const ARCHETYPES = ["software", "research", "content", "automation", "custom"] as const;
export type Archetype = (typeof ARCHETYPES)[number];
