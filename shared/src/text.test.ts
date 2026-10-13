import { describe, expect, it } from "vitest";
import { detectLang, normalize } from "./text";

describe("normalize", () => {
  it("lowercases, trims and strips punctuation", () => {
    expect(normalize("  Chai!! ")).toBe("chai");
    expect(normalize("Hello, World.")).toBe("hello world");
  });

  it("strips emoji and symbols", () => {
    expect(normalize("chai ☕️")).toBe("chai");
    expect(normalize("🤏🤏")).toBe("");
  });

  it("collapses internal whitespace", () => {
    expect(normalize("ice \t  cream")).toBe("ice cream");
  });

  it("keeps Kannada, Devanagari and Tamil intact, including vowel signs", () => {
    expect(normalize("ನಾಯಿ")).toBe("ನಾಯಿ");
    expect(normalize("कुत्ता")).toBe("कुत्ता");
    expect(normalize("நாய்")).toBe("நாய்");
  });

  it("removes Devanagari danda (punctuation) but not letters", () => {
    expect(normalize("चाय।")).toBe("चाय");
  });

  it("applies NFC so composed and decomposed forms match", () => {
    expect(normalize("cafe\u{0301}")).toBe(normalize("café"));
  });

  it("keeps ZWJ/ZWNJ inside Indic words, drops them elsewhere", () => {
    expect(normalize("क्\u{200D}ष")).toBe("क्\u{200D}ष");
    expect(normalize("do\u{200D}g")).toBe("dog");
    expect(normalize("\u{200B}chai\u{FEFF}")).toBe("chai");
  });

  it("caps length at 24 characters (code points)", () => {
    expect(Array.from(normalize("a".repeat(40)))).toHaveLength(24);
    expect(Array.from(normalize("ನ".repeat(30)))).toHaveLength(24);
  });
});

describe("detectLang", () => {
  it("detects scripts", () => {
    expect(detectLang("ನಾಯಿ", "en")).toBe("kn");
    expect(detectLang("कुत्ता", "en")).toBe("hi");
    expect(detectLang("நாய்", "en")).toBe("ta");
    expect(detectLang("కుక్క", "en")).toBe("te");
  });

  it("uses Marathi for Devanagari when the player chose Marathi", () => {
    expect(detectLang("कुत्रा", "mr")).toBe("mr");
  });

  it("falls back to the player's choice for Latin script", () => {
    expect(detectLang("dog", "en")).toBe("en");
    expect(detectLang("naayi", "kn")).toBe("kn");
  });
});
