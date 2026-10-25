import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_LABELS, FURNITURE_CATALOG, getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";
import { ROOM_KINDS, type RoomKind } from "./autolayout";
import { isHexColor } from "./color";
import { STYLES, getStyle } from "./styles";

/**
 * Optional vision analysis with Claude. Everything here runs in the browser with the user's own API key
 * and only when they press the button: the photos are sent to Anthropic, nothing is stored by this app.
 */
export const AI_MODEL = "claude-opus-5-5";
export const KEY_STORAGE = "roomcraft3d:anthropic-key";

export interface AiSuggestion {
  catalogId: string;
  reason: string;
  color?: string;
}
export interface AiAnalysis {
  roomType: RoomKind | "other";
  styleId: string | null;
  summary: string;
  palette: string[];
  observations: string[];
  suggestions: AiSuggestion[];
}

const ROOM_TYPES = [...ROOM_KINDS.map((k) => k.value), "other"] as const;
const STYLE_IDS = [...STYLES.map((s) => s.id), "other"] as const;

/** JSON schema for structured output — the model can only name catalogue ids that exist. */
export function responseSchema() {
  return {
    type: "object",
    properties: {
      roomType: { type: "string", enum: [...ROOM_TYPES] },
      style: { type: "string", enum: [...STYLE_IDS] },
      summary: { type: "string" },
      palette: { type: "array", items: { type: "string" } },
      observations: { type: "array", items: { type: "string" } },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            catalogId: { type: "string", enum: FURNITURE_CATALOG.map((c) => c.id) },
            reason: { type: "string" },
            color: { type: "string" },
          },
          required: ["catalogId", "reason", "color"],
          additionalProperties: false,
        },
      },
    },
    required: ["roomType", "style", "summary", "palette", "observations", "suggestions"],
    additionalProperties: false,
  } as const;
}

export function buildPrompt(opts: { roomHint: RoomKind | "other"; room: RoomConfig; existing: PlacedItem[]; wishes: string }) {
  const catalogue = FURNITURE_CATALOG.map((c) => `${c.id} | ${c.name} | ${Math.round(c.width * 100)}x${Math.round(c.depth * 100)}x${Math.round(c.height * 100)} cm | ${CATEGORY_LABELS[c.category]}`).join("\n");
  const have = opts.existing.length ? opts.existing.map((i) => i.name).join(", ") : "nothing yet";
  return [
    "You are an interior-design assistant inside a room-planning app. Study the attached photo(s) of a real room (one may be an equirectangular 360° panorama).",
    "Tell me: what kind of room it is, which of the listed interior styles it is closest to, a short summary of what you see, its dominant colours as #RRGGBB hex codes (up to 5), and 3-6 short observations (existing furniture, light, problems).",
    "Then suggest 4-8 pieces of furniture from THE CATALOGUE BELOW ONLY (use the exact catalogId) that would improve or complete the room. For each, give a one-sentence reason and a #RRGGBB colour that suits the room.",
    "Do not suggest pieces that are already visible in the photos or already in the layout. Keep every piece sensible for the room size.",
    "",
    `The user thinks this is: ${opts.roomHint === "other" ? "not sure" : opts.roomHint}.`,
    `Floor plan size: ${Math.round(opts.room.length * 100)} x ${Math.round(opts.room.width * 100)} cm, wall height ${Math.round(opts.room.wallHeight * 100)} cm.`,
    `Already placed in the app layout: ${have}.`,
    opts.wishes.trim() ? `What the user asked for: ${opts.wishes.trim().slice(0, 300)}` : "",
    "",
    `Style ids: ${STYLES.map((s) => `${s.id} (${s.name})`).join(", ")}, other.`,
    "",
    "CATALOGUE (catalogId | name | size | category):",
    catalogue,
  ]
    .filter(Boolean)
    .join("\n");
}

const MEDIA = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/;

export class AiError extends Error {}

/** Parses and sanitises the model's JSON; drops unknown catalogue ids and malformed colours. */
export function parseAiResult(text: string): AiAnalysis {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new AiError("The model did not return structured data.");
    raw = JSON.parse(m[0]);
  }
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
  const roomType = (ROOM_TYPES as readonly string[]).includes(o.roomType as string) ? (o.roomType as RoomKind | "other") : "other";
  const styleId = typeof o.style === "string" && getStyle(o.style) ? o.style : null;
  const suggestions: AiSuggestion[] = [];
  for (const s of Array.isArray(o.suggestions) ? o.suggestions : []) {
    const r = s as Record<string, unknown>;
    if (typeof r.catalogId !== "string" || !getCatalogItem(r.catalogId)) continue;
    if (suggestions.some((x) => x.catalogId === r.catalogId)) continue;
    suggestions.push({ catalogId: r.catalogId, reason: str(r.reason, 240), color: isHexColor(r.color) ? r.color : undefined });
    if (suggestions.length >= 8) break;
  }
  return {
    roomType,
    styleId,
    summary: str(o.summary, 600),
    palette: (Array.isArray(o.palette) ? o.palette : []).filter(isHexColor).slice(0, 5),
    observations: (Array.isArray(o.observations) ? o.observations : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 8),
    suggestions,
  };
}

export async function analyzeWithClaude(opts: {
  apiKey: string;
  images: string[];
  roomHint: RoomKind | "other";
  room: RoomConfig;
  existing: PlacedItem[];
  wishes: string;
  signal?: AbortSignal;
}): Promise<AiAnalysis> {
  const images = opts.images.slice(0, 6).map((u) => {
    const m = u.match(MEDIA);
    if (!m) throw new AiError("One of the photos is not a supported image type.");
    return { type: "image" as const, source: { type: "base64" as const, media_type: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] } };
  });
  if (!images.length) throw new AiError("Add at least one photo first.");
  // The key is the user's own; the SDK needs an explicit opt-in to run in a browser.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  try {
    const res = await client.beta.messages.create(
      {
        model: AI_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: responseSchema() as unknown as Record<string, unknown> } },
        messages: [{ role: "user", content: [...images, { type: "text", text: buildPrompt(opts) }] }],
      },
      { signal: opts.signal },
    );
    if (res.stop_reason === "refusal") throw new AiError("Claude declined to analyse these photos. Try different photos.");
    if (res.stop_reason === "max_tokens") throw new AiError("The answer was cut off. Try fewer photos.");
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new AiError("The model returned no text.");
    return parseAiResult(text.text);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The API key was rejected. Check it and try again.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError("This API key is not allowed to use that model.");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Rate limited — wait a moment and try again.");
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`The request was rejected: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError("Could not reach api.anthropic.com. Check your connection (or a blocking extension).");
    if (e instanceof Anthropic.APIError) throw new AiError(`Claude API error ${e.status ?? ""}: ${e.message}`);
    throw new AiError(e instanceof Error ? e.message : "Analysis failed.");
  }
}

export function loadStoredKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}
export function storeKey(key: string | null) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable: the key then lasts for this session only */
  }
}
