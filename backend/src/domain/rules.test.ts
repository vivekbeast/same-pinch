import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG as C } from "./config";
import { crowdHeat } from "./crowd";
import { samePinch, scoreRound, type ScoredWord } from "./match";
import {
  dailyGrade,
  dailyNumber,
  displayFlame,
  generateHandle,
  goldAccuracy,
  isHotRound,
  levelFor,
  maskUpi,
  nextFlame,
  qualityMultiplier,
  roundEarnPaise,
  roundXp,
  roundXpWithSpot,
  streakEndingAt,
  weekStart,
} from "./rules";

describe("levels", () => {
  it("maps xp to level and progress", () => {
    expect(levelFor(0, C.levels)).toMatchObject({ value: 1, progress: [0, 150] });
    expect(levelFor(149, C.levels).value).toBe(1);
    expect(levelFor(150, C.levels).value).toBe(2);
    expect(levelFor(820, C.levels)).toMatchObject({ value: 3, nameKey: "level.mind_reader", progress: [320, 1000] });
    expect(levelFor(9000, C.levels)).toMatchObject({ value: 5, progress: [5000, 5000] });
  });
});

describe("pay", () => {
  it("gives new players 0.8 accuracy until they have enough gold samples", () => {
    expect(goldAccuracy(0, 0, C.pay)).toBe(0.8);
    expect(goldAccuracy(1, 2, C.pay)).toBe(0.8);
    expect(goldAccuracy(3, 4, C.pay)).toBe(0.75);
  });

  it("clamps the quality multiplier to 0.5–1.5", () => {
    expect(qualityMultiplier(0.7, C.pay)).toBe(1.2);
    expect(qualityMultiplier(0, C.pay)).toBe(0.5);
    expect(qualityMultiplier(1, C.pay)).toBe(1.5);
  });

  it("pays only verified pinches, with a Bhasha bonus", () => {
    expect(roundEarnPaise("exact", 1.2, C.pay)).toBe(60);
    expect(roundEarnPaise("bhasha", 1.2, C.pay)).toBe(90);
    expect(roundEarnPaise("near", 1.5, C.pay)).toBe(0);
    expect(roundEarnPaise("miss", 1.5, C.pay)).toBe(0);
    expect(roundEarnPaise("skipped", 1.5, C.pay)).toBe(0);
  });

  it("awards XP by tier, +2 per extra match", () => {
    expect(roundXp("exact", 1, C.xp)).toBe(10);
    expect(roundXp("exact", 3, C.xp)).toBe(14);
    expect(roundXp("bhasha", 2, C.xp)).toBe(17);
    expect(roundXp("near", 0, C.xp)).toBe(4);
    expect(roundXp("miss", 0, C.xp)).toBe(1);
    expect(roundXp("skipped", 0, C.xp)).toBe(0);
  });
});

describe("flame", () => {
  const base = { flame: 6, best: 6, freezes: 0, lastPlayDay: "2026-10-12" };

  it("starts at 1 on the first ever pack", () => {
    expect(nextFlame({ flame: 0, best: 0, freezes: 0, lastPlayDay: null }, "2026-10-13", C.flame)).toMatchObject({ flame: 1, increased: true });
  });

  it("counts a day once", () => {
    expect(nextFlame({ ...base, lastPlayDay: "2026-10-13" }, "2026-10-13", C.flame)).toMatchObject({ flame: 6, increased: false });
  });

  it("ignores packs from before the last played day (late offline sync)", () => {
    expect(nextFlame(base, "2026-10-11", C.flame)).toMatchObject({ flame: 6, increased: false, lastPlayDay: "2026-10-12" });
  });

  it("grows on consecutive days and earns a freeze at day 7", () => {
    expect(nextFlame(base, "2026-10-13", C.flame)).toMatchObject({ flame: 7, best: 7, freezes: 1, increased: true });
  });

  it("uses a freeze to cover one missed day", () => {
    expect(nextFlame({ ...base, freezes: 1, lastPlayDay: "2026-10-11" }, "2026-10-13", C.flame)).toEqual({
      flame: 7,
      best: 7,
      freezes: 1, // −1 used, +1 earned at day 7
      lastPlayDay: "2026-10-13",
      increased: true,
      frozenDays: ["2026-10-12"],
      broke: false,
    });
  });

  it("breaks when freezes can't cover the gap, keeping best", () => {
    expect(nextFlame({ ...base, freezes: 1, lastPlayDay: "2026-10-10" }, "2026-10-13", C.flame)).toMatchObject({
      flame: 1,
      best: 6,
      freezes: 1,
      broke: true,
    });
  });

  it("never holds more than 2 freezes", () => {
    expect(nextFlame({ flame: 13, best: 13, freezes: 2, lastPlayDay: "2026-10-12" }, "2026-10-13", C.flame).freezes).toBe(2);
  });

  it("shows a broken flame as 0 and a frozen gap as still alive", () => {
    expect(displayFlame(base, "2026-10-12")).toEqual({ value: 6, safeToday: true });
    expect(displayFlame(base, "2026-10-13")).toEqual({ value: 6, safeToday: false });
    expect(displayFlame(base, "2026-10-14")).toEqual({ value: 0, safeToday: false });
    expect(displayFlame({ ...base, freezes: 1 }, "2026-10-14")).toEqual({ value: 6, safeToday: false });
  });

  it("measures a streak from history with frozen days bridging", () => {
    const h = new Map([
      ["2026-10-08", { played: true, kept: true }],
      ["2026-10-09", { played: false, kept: true }],
      ["2026-10-10", { played: true, kept: true }],
      ["2026-10-11", { played: true, kept: true }],
    ]);
    expect(streakEndingAt(h, "2026-10-11")).toBe(3);
    expect(streakEndingAt(h, "2026-10-12")).toBe(0);
  });
});

describe("leaderboard & daily", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-13")).toBe("2026-10-12"); // Tuesday → Monday
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sunday
  });

  it("numbers daily challenges from launch", () => {
    expect(dailyNumber("2026-10-13", C.daily.launchDay)).toBe(142);
  });

  it("grades against the answer distribution", () => {
    const ranked = ["c_tea", "c_rain", "c_glass", "c_hot", "c_steam", "c_cup"];
    expect(dailyGrade("c_tea", ranked)).toBe("top");
    expect(dailyGrade("c_steam", ranked)).toBe("top5");
    expect(dailyGrade("c_cup", ranked)).toBe("none");
    expect(dailyGrade(null, ranked)).toBe("none");
  });
});

describe("misc", () => {
  it("masks UPI ids", () => {
    expect(maskUpi("vivek.t@okaxis")).toBe("v***@okaxis");
  });

  it("generates valid handles", () => {
    let x = 0;
    const rand = () => ((x = (x + 0.37) % 1), x);
    for (let i = 0; i < 50; i++) expect(generateHandle(rand)).toMatch(/^[a-z0-9_]{3,20}$/);
  });
});

describe("match engine", () => {
  const w = (text: string, lang: ScoredWord["lang"], concepts: string[], extra: Partial<ScoredWord> = {}): ScoredWord => ({
    text,
    lang,
    concepts,
    lowInfo: false,
    burnt: false,
    ...extra,
  });
  const related = (a: string, b: string) => (a === "c_dog" && b === "c_puppy") || (a === "c_puppy" && b === "c_dog");

  it("same concept, same language → exact", () => {
    const r = scoreRound([w("chai", "hi", ["c_tea"])], [w("chai", "hi", ["c_tea"])], related);
    expect(r).toMatchObject({ result: "exact", matchKeys: ["c_tea"], youMatched: [true], partnerMatched: [true] });
  });

  it("same concept, different language → bhasha (naayi = kutta = dog)", () => {
    const r = scoreRound([w("naayi", "kn", ["c_dog"])], [w("kutta", "hi", ["c_dog"]), w("road", "en", ["c_road"])], related);
    expect(r).toMatchObject({ result: "bhasha", matchKeys: ["c_dog"], partnerMatched: [true, false] });
  });

  it("bhasha beats exact when both happen", () => {
    const r = scoreRound([w("tea", "en", ["c_tea"]), w("rain", "en", ["c_rain"])], [w("chai", "hi", ["c_tea"]), w("rain", "en", ["c_rain"])], related);
    expect(r.result).toBe("bhasha");
    expect(r.matchKeys.sort()).toEqual(["c_rain", "c_tea"]);
  });

  it("related concepts → near", () => {
    expect(scoreRound([w("puppy", "en", ["c_puppy"])], [w("dog", "en", ["c_dog"])], related).result).toBe("near");
  });

  it("identical unknown words match exactly; different-language unknowns become review candidates", () => {
    expect(scoreRound([w("biryani", "en", [])], [w("biryani", "en", [])], related)).toMatchObject({ result: "exact", matchKeys: ["t:biryani"] });
    const r = scoreRound([w("biryani", "en", [])], [w("ಬಿರಿಯಾನಿ", "kn", [])], related);
    expect(r.result).toBe("miss");
    expect(r.unknownPairs).toHaveLength(1);
  });

  it("translation stacking can't buy the Bhasha bonus (dog + कुत्ता vs कुत्ता → exact)", () => {
    const r = scoreRound([w("dog", "en", ["c_dog"]), w("कुत्ता", "hi", ["c_dog"])], [w("कुत्ता", "hi", ["c_dog"])], related);
    expect(r.result).toBe("exact");
    // One word, in a different language from the partner's, is still a real Bhasha pinch.
    expect(scoreRound([w("dog", "en", ["c_dog"])], [w("कुत्ता", "hi", ["c_dog"])], related).result).toBe("bhasha");
  });

  it("low-information and burnt words never match", () => {
    expect(scoreRound([w("nice", "en", [], { lowInfo: true })], [w("nice", "en", [], { lowInfo: true })], related).result).toBe("miss");
    expect(scoreRound([w("dog", "en", ["c_dog"], { burnt: true })], [w("dog", "en", ["c_dog"])], related).result).toBe("miss");
  });
});

describe("pinch the picture", () => {
  it("same spot within the radius, inclusive; otherwise not", () => {
    expect(samePinch({ x: 500, y: 500 }, { x: 600, y: 500 }, 170)).toBe(true);
    expect(samePinch({ x: 500, y: 500 }, { x: 620, y: 620 }, 170)).toBe(true); // ≈ 169.7
    expect(samePinch({ x: 500, y: 500 }, { x: 621, y: 621 }, 170)).toBe(false);
    expect(samePinch({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 170)).toBe(false);
  });

  it("a same spot adds XP on top of the word result, and never money", () => {
    expect(roundXpWithSpot("miss", 0, true, C)).toBe(C.xp.miss + C.pinch.spotXp);
    expect(roundXpWithSpot("exact", 1, true, C)).toBe(C.xp.exact + C.pinch.spotXp);
    expect(roundXpWithSpot("exact", 1, false, C)).toBe(C.xp.exact);
    expect(roundEarnPaise("miss", 1, C.pay)).toBe(0);
  });
});

describe("hot hand", () => {
  const hot = { after: 3, timeShare: 0.5, graceMs: 1_000 };
  it("needs the last 3 results to be pinches", () => {
    expect(isHotRound(["exact", "bhasha", "exact"], 5_000, 20, hot)).toBe(true);
    expect(isHotRound(["miss", "exact", "bhasha", "exact"], 5_000, 20, hot)).toBe(true);
    expect(isHotRound(["exact", "near", "exact"], 5_000, 20, hot)).toBe(false);
    expect(isHotRound(["exact", "exact"], 5_000, 20, hot)).toBe(false);
  });
  it("only counts inside the shortened timer", () => {
    expect(isHotRound(["exact", "exact", "exact"], 11_000, 20, hot)).toBe(true); // dropped by the timer itself
    expect(isHotRound(["exact", "exact", "exact"], 11_001, 20, hot)).toBe(false);
  });
});

describe("crowd heatmap", () => {
  const cfg = { window: 500, cell: 50, maxCells: 3, minAnswers: 3 };
  it("stays hidden below the minimum", () => {
    expect(crowdHeat([{ x: 1, y: 1 }, { x: 2, y: 2 }], { x: 0, y: 0 }, 170, cfg)).toBeNull();
  });
  it("bins points busiest first and measures how many are near you", () => {
    const pts = [
      { x: 510, y: 510 },
      { x: 520, y: 540 },
      { x: 530, y: 505 },
      { x: 100, y: 100 },
      { x: 1000, y: 1000 },
    ];
    const c = crowdHeat(pts, { x: 500, y: 500 }, 170, cfg)!;
    expect(c.n).toBe(5);
    expect(c.near).toBe(60);
    expect(c.cells[0]).toEqual([525, 525, 3]);
    expect(c.cells).toContainEqual([975, 975, 1]); // the grid edge lands in the last cell
  });
  it("caps the number of cells", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ x: i * 100, y: 0 }));
    expect(crowdHeat(pts, { x: 0, y: 0 }, 170, cfg)!.cells).toHaveLength(3);
  });
});
