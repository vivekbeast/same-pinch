import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom tokens so e.g. `rounded-card` and `rounded-full` don't both survive.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["card", "tile", "icon", "plate"],
      shadow: ["card", "float", "night"],
      text: ["hero", "title", "section", "numeral"],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
