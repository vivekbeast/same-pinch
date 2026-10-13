// Prompt catalogue (docs/CONTENT_I18N.md §4). Prompt IDs are derived from `key`, so they stay stable
// across reseeds (offline packs on phones keep working).
//   likely — concepts people tend to say, most common first (drives seeded partner answers)
//   gold   — hidden test prompts with an unambiguous answer (never revealed to clients)
//   burnt  — pre-burnt concepts so the Burnt Words mechanic is visible in the demo
//   subject — what the photo must show (image/vibe); assets live at /prompts/<key>-{320,480,720}.webp
import type { PromptKind, Theme } from "@shared";

export interface PromptSeed {
  key: string;
  kind: PromptKind;
  theme: Theme;
  likely: string[];
  subject?: string; // image + vibe
  text?: string; // question prompts: English copy for prompt.q.<key>
  gold?: string[];
  burnt?: string[];
  /** Kept in the catalogue but never served (e.g. no licensed photo yet). */
  inactive?: boolean;
}

const img = (key: string, theme: Theme, subject: string, likely: string[], extra: Partial<PromptSeed> = {}): PromptSeed => ({
  key,
  kind: "image",
  theme,
  subject,
  likely,
  ...extra,
});
const vibe = (key: string, subject: string, likely: string[]): PromptSeed => ({ key, kind: "vibe", theme: "feelings", subject, likely });
const q = (key: string, theme: Theme, text: string, likely: string[], extra: Partial<PromptSeed> = {}): PromptSeed => ({
  key,
  kind: "question",
  theme,
  text,
  likely,
  ...extra,
});

export const PROMPTS: PromptSeed[] = [
  // ---------- Food ----------
  img("chai-glass", "food", "Cutting chai in a small glass on a wet bench, steam rising", ["c_tea", "c_rain", "c_glass", "c_hot", "c_steam"], { burnt: ["c_tea"] }),
  img("samosa-plate", "food", "Two samosas with green chutney on a steel plate", ["c_samosa", "c_snack", "c_chutney", "c_fried", "c_spicy"], { burnt: ["c_samosa"] }),
  img("idli-sambar", "food", "Idli with sambar and coconut chutney on a banana leaf", ["c_idli", "c_sambar", "c_breakfast", "c_chutney", "c_white"]),
  img("mango-pile", "food", "Pile of ripe yellow mangoes at a market stall", ["c_mango", "c_fruit", "c_yellow", "c_summer", "c_market"], { burnt: ["c_mango"] }),
  img("masala-dosa", "food", "Crispy masala dosa folded on a plate", ["c_dosa", "c_breakfast", "c_crispy", "c_chutney", "c_sambar"]),
  img("jalebi-tray", "food", "Orange jalebis stacked on a tray", ["c_jalebi", "c_sweet", "c_orange", "c_fried"]),
  img("pani-puri", "food", "Pani puri being served at a street stall", ["c_panipuri", "c_street_food", "c_spicy", "c_water"]),
  img("veg-thali", "food", "A vegetarian thali with rice, dal and small bowls", ["c_thali", "c_rice", "c_food", "c_lunch"]),
  img("roasted-corn", "food", "Corn cob roasting on glowing coals at a roadside cart", ["c_corn", "c_fire", "c_rain", "c_roasted", "c_street_food"], { burnt: ["c_corn"] }),

  // ---------- Weather ----------
  img("monsoon-street", "weather", "Flooded city street in heavy rain with umbrellas", ["c_rain", "c_umbrella", "c_street", "c_water", "c_monsoon"], { burnt: ["c_rain"] }),
  img("red-umbrella", "weather", "A single red umbrella in the rain", ["c_umbrella", "c_rain", "c_red"], { inactive: true }), // no CC0 photo yet (content/CREDITS.md)
  img("rainbow-field", "weather", "Rainbow over green fields after rain", ["c_rainbow", "c_sky", "c_colours", "c_rain", "c_field"]),
  img("lightning-night", "weather", "Lightning bolt over a city at night", ["c_lightning", "c_storm", "c_night", "c_sky"]),
  img("hot-sun-field", "weather", "Harsh midday sun over a dry field", ["c_sun", "c_hot", "c_summer", "c_field"]),
  img("foggy-road", "weather", "Highway disappearing into thick winter fog", ["c_fog", "c_winter", "c_cold", "c_road"]),

  // ---------- City ----------
  img("auto-rickshaw", "city_sounds", "Yellow-green auto rickshaw on a busy road", ["c_auto", "c_yellow", "c_traffic", "c_road"], { burnt: ["c_auto"] }),
  img("traffic-jam", "city_sounds", "Cars and bikes stuck in a traffic jam", ["c_traffic", "c_car", "c_horn", "c_road", "c_noise"]),
  img("train-platform", "city_sounds", "Crowded railway platform with a train arriving", ["c_train", "c_station", "c_travel", "c_crowd"]),
  img("street-dog", "city_sounds", "A brown street dog sleeping on a quiet road", ["c_dog", "c_street", "c_sleep", "c_animal"], { gold: ["c_dog", "c_puppy"] }),
  img("cow-road", "city_sounds", "A white cow standing in the middle of a road", ["c_cow", "c_road", "c_animal", "c_street"], { gold: ["c_cow"] }),
  img("market-crowd", "city_sounds", "Busy market lane full of shoppers", ["c_market", "c_crowd", "c_shopping", "c_people"]),

  // ---------- Festivals (non-religious framing) ----------
  img("diyas-row", "festivals", "A row of lit clay lamps at dusk", ["c_lamp", "c_light", "c_festival", "c_night"], { burnt: ["c_lamp"] }),
  img("rangoli-floor", "festivals", "Colourful rangoli pattern on a floor", ["c_rangoli", "c_colours", "c_art", "c_festival"]),
  img("kites-sky", "festivals", "Many kites flying in a blue sky", ["c_kite", "c_sky", "c_festival", "c_wind"]),
  img("colour-powder", "festivals", "Heaps of bright coloured powder in bowls", ["c_colours", "c_powder", "c_festival", "c_pink"]),
  img("fireworks-night", "festivals", "Fireworks bursting over rooftops at night", ["c_fireworks", "c_night", "c_festival", "c_light", "c_celebration"]),
  img("sweets-box", "festivals", "Open box of assorted Indian sweets", ["c_sweet", "c_box", "c_gift", "c_festival", "c_laddu"]),

  // ---------- College ----------
  img("notebook-pen", "college", "Open notebook with handwritten notes and a pen", ["c_book", "c_pen", "c_study", "c_exam"]),
  img("college-canteen", "college", "College canteen counter with plates of food", ["c_canteen", "c_food", "c_friends", "c_college"]),
  img("backpack-desk", "college", "School backpack on a classroom desk", ["c_bag", "c_school", "c_college", "c_book"]),
  img("cricket-gully", "college", "Bat and ball lying on a street cricket pitch", ["c_cricket", "c_bat", "c_ball", "c_sport"], { burnt: ["c_cricket"] }),
  img("phone-charging", "college", "Phone plugged in showing a low battery", ["c_phone", "c_battery", "c_charger"]),

  // ---------- Travel ----------
  img("bus-window-dusk", "travel", "View from a bus window at dusk", ["c_bus", "c_window", "c_travel", "c_evening"]),
  img("goa-beach", "travel", "Empty beach with waves and palm trees", ["c_beach", "c_sea", "c_sand", "c_holiday"]),
  img("snow-mountains", "travel", "Snow-capped mountains above a valley", ["c_mountain", "c_snow", "c_cold", "c_travel"]),
  img("backwater-boat", "travel", "Houseboat on calm backwaters", ["c_boat", "c_water", "c_river", "c_kerala"]),
  img("bicycle-lane", "travel", "Old bicycle leaning on a village wall", ["c_cycle", "c_road", "c_ride"]),

  // ---------- Gold (hidden test prompts, unambiguous single subject) ----------
  img("gold-cat", "city_sounds", "A cat sitting on a wall, plain background", ["c_cat", "c_animal"], { gold: ["c_cat"] }),
  img("gold-banana", "food", "A bunch of bananas on a table", ["c_banana", "c_fruit", "c_yellow"], { gold: ["c_banana"] }),
  img("gold-elephant", "travel", "An elephant standing in a forest clearing", ["c_elephant", "c_animal"], { gold: ["c_elephant"] }),
  img("gold-clock", "college", "A round wall clock", ["c_clock"], { gold: ["c_clock"] }),
  img("gold-peacock", "travel", "A peacock with its feathers spread", ["c_peacock", "c_bird", "c_colours"], { gold: ["c_peacock", "c_bird"] }),
  img("gold-tree", "weather", "One large tree alone in a field", ["c_tree", "c_field"], { gold: ["c_tree"] }),
  img("gold-moon", "weather", "Full moon in a dark sky", ["c_moon", "c_night", "c_sky"], { gold: ["c_moon"] }),
  img("gold-car", "city_sounds", "A red car parked on an empty street", ["c_car", "c_red", "c_road"], { gold: ["c_car"] }),

  // ---------- Vibe (one-word feeling) ----------
  vibe("vibe-bus-stop-night", "Empty bus stop under one streetlight at night", ["c_lonely", "c_quiet", "c_night", "c_waiting", "c_cold"]),
  vibe("vibe-sunrise-sea", "Sunrise over a calm sea", ["c_calm", "c_hope", "c_morning", "c_happy"]),
  vibe("vibe-friends-silhouette", "Silhouettes of friends laughing on a terrace at sunset", ["c_happy", "c_friends", "c_fun", "c_evening"]),
  vibe("vibe-rain-window", "Raindrops on a window with a cup of tea inside", ["c_calm", "c_comfort", "c_rain", "c_sleep", "c_tea"]),
  vibe("vibe-exam-hall", "Rows of empty desks in an exam hall", ["c_tension", "c_exam", "c_fear", "c_quiet"]),
  vibe("vibe-festival-lights", "String lights over a street at night", ["c_happy", "c_celebration", "c_light", "c_festival"]),
  vibe("vibe-honking-traffic", "Gridlocked traffic in the afternoon heat", ["c_angry", "c_noise", "c_tired", "c_traffic"]),
  vibe("vibe-lazy-afternoon", "Fan spinning above an empty bed on a hot afternoon", ["c_lazy", "c_sleep", "c_hot", "c_tired"]),

  // ---------- Questions ----------
  q("eat_in_rain", "food", "Something you eat when it rains", ["c_pakoda", "c_tea", "c_corn", "c_noodles", "c_samosa"], { burnt: ["c_pakoda"] }),
  q("monday_word", "feelings", "One word for Monday", ["c_tired", "c_work", "c_sleep", "c_lazy"]),
  q("morning_sound", "city_sounds", "A sound you hear every morning", ["c_alarm", "c_bird", "c_cooker", "c_horn"]),
  q("in_your_bag", "college", "Something always in your bag", ["c_phone", "c_charger", "c_wallet", "c_keys", "c_bottle"]),
  q("summer_drink", "food", "Best drink on a hot day", ["c_lassi", "c_lemonade", "c_coconut_water", "c_juice", "c_water"]),
  q("cricket_word", "college", "One word about cricket", ["c_six", "c_bat", "c_ball", "c_wicket"]),
  q("first_thing_morning", "feelings", "First thing you do in the morning", ["c_tea", "c_phone", "c_brush", "c_coffee"]),
  q("happy_colour", "festivals", "The colour of happiness", ["c_yellow", "c_orange", "c_pink", "c_red"]),
  q("street_food", "food", "Your favourite street food", ["c_panipuri", "c_samosa", "c_vada_pav", "c_momos", "c_street_food"]),
  q("indian_animal", "travel", "An animal you think of for India", ["c_tiger", "c_peacock", "c_elephant", "c_cow", "c_dog"]),
  q("wedding_thing", "festivals", "Something you always see at a wedding", ["c_food", "c_dance", "c_music", "c_light"]),
  q("long_journey", "travel", "Something you need on a long journey", ["c_water", "c_music", "c_snack", "c_phone", "c_pillow"]),
  q("night_sound", "city_sounds", "A sound you hear at night", ["c_dog", "c_quiet", "c_fan", "c_horn"]),
  q("something_cold", "weather", "Something cold", ["c_ice", "c_ice_cream", "c_fridge", "c_snow"]),
  q("college_fear", "college", "Every student's biggest worry", ["c_exam", "c_attendance", "c_viva", "c_results"]),
  q("favourite_sweet", "festivals", "Name a sweet", ["c_laddu", "c_jalebi", "c_gulab_jamun", "c_rasgulla"]),
  q("hot_day", "weather", "Something you need on a hot day", ["c_fan", "c_ac", "c_water", "c_ice_cream"]),
  q("breakfast", "food", "A breakfast word", ["c_idli", "c_poha", "c_paratha", "c_dosa", "c_bread"]),
  q("power_cut", "city_sounds", "Something you use in a power cut", ["c_candle", "c_torch", "c_phone", "c_fan"]),
  q("mother_says", "feelings", "Something your mother always says", ["c_eat", "c_study", "c_sleep", "c_home"]),
  q("friday_word", "feelings", "One word for Friday", ["c_weekend", "c_celebration", "c_movie", "c_happy"]),
  q("monsoon_smell", "weather", "The smell of the first rain", ["c_soil", "c_rain", "c_wet", "c_tea"]),
  q("kitchen_sound", "city_sounds", "A sound from the kitchen", ["c_cooker", "c_mixer", "c_tadka"]),
  q("travel_by", "travel", "How you travel to college or work", ["c_bus", "c_auto", "c_train", "c_cycle"]),
];
