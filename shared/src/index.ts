// Shared between frontend and backend: constants, zod schemas, normalize(), detectLang().
// Both apps import zod from here (`import { z } from "@shared"`) so there is exactly one zod copy.
export { z } from "zod";

export * from "./constants";
export * from "./regions";
export * from "./text";
export * as api from "./api";
