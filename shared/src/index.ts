// Shared between frontend and backend: constants, zod schemas, normalize(), detectLang().
// Both apps import zod from here (`import { z } from "@shared"`) so there is exactly one zod copy.
export { z } from "zod";

export const LANGS = ["en", "hi", "kn", "ta", "te", "mr"] as const;
export type Lang = (typeof LANGS)[number];
