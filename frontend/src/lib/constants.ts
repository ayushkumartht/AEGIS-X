/** Application-wide frontend constants. */

export const APP_NAME = "AEGIS-X" as const;
export const APP_VERSION = "0.2.0" as const;
export const APP_TAGLINE = "Decision Intelligence for Crisis Response" as const;

export const DOMAINS = ["flood", "fire", "crowd"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  flood: "Flood Evacuation",
  fire: "Wildfire Response",
  crowd: "Crowd Evacuation",
};

export const DOMAIN_COLORS: Record<Domain, string> = {
  flood: "#3b82f6",
  fire: "#ef4444",
  crowd: "#f59e0b",
};

export const MC_DEFAULT_SAMPLES = 1000;
export const MC_DEFAULT_SEED = 42;
export const CHART_ANIMATION_MS = 400;
