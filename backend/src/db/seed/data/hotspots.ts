// Where people's eyes go first on each photo (docs/DECISIONS.md D39). Hand-marked from the actual
// assets in frontend/public/prompts: [x, y, weight] on the 0–1000 pinch grid (x → right, y → down).
// Seeded partners pinch near one of these (weighted, with jitter), so Pinch the Picture has believable
// partners from day one. Real answers replace them as soon as people play.
export type Hotspot = readonly [x: number, y: number, weight: number];

export const HOTSPOTS: Record<string, readonly Hotspot[]> = {
  // food
  "chai-glass": [[730, 480, 2], [500, 150, 1], [680, 880, 1]], // the red glass · the glasses on top · the hand
  "samosa-plate": [[380, 700, 3], [880, 120, 1]], // samosa · chutney
  "idli-sambar": [[450, 640, 3], [190, 220, 2]], // idlis · the steel tumbler
  "mango-pile": [[540, 580, 3], [300, 200, 1]], // green mango · red fruit behind
  "masala-dosa": [[440, 260, 2], [620, 670, 2]], // top · front
  "jalebi-tray": [[500, 500, 3], [550, 110, 1]], // the centre swirl · the flower print
  "pani-puri": [[510, 740, 3], [520, 250, 1]], // front plate · back plate
  "veg-thali": [[440, 560, 2], [720, 700, 2], [210, 770, 1], [580, 240, 1]], // rice · roti · curry · salad
  "roasted-corn": [[530, 560, 3], [300, 420, 1]], // the cob · embers
  // weather
  "monsoon-street": [[520, 580, 3], [410, 880, 1]], // person in red · scooters
  "rainbow-field": [[300, 250, 3], [650, 930, 1]], // the arc · hills
  "lightning-night": [[330, 350, 2], [600, 200, 2], [500, 700, 1]], // bolts · town lights
  "hot-sun-field": [[840, 640, 3], [450, 450, 1]], // the one plant · cracks
  "foggy-road": [[260, 540, 3], [750, 350, 1]], // walker in red · trees
  // city
  "auto-rickshaw": [[420, 760, 2], [400, 260, 1], [840, 700, 1], [600, 400, 1]], // meter · mirror · driver · road
  "traffic-jam": [[650, 700, 2], [120, 120, 1], [440, 240, 1]], // cars · tower · billboard
  "train-platform": [[780, 410, 2], [500, 700, 2], [330, 490, 1]], // station board · person · blue sign
  "street-dog": [[560, 630, 3], [870, 400, 1]], // nose · eye
  "cow-road": [[290, 610, 3], [520, 500, 1]], // cow · stop sign
  "market-crowd": [[340, 80, 2], [440, 580, 2], [300, 820, 1]], // umbrella · tomatoes · price card
  // festivals
  "diyas-row": [[510, 500, 3], [370, 330, 1]], // the flame · flowers
  "rangoli-floor": [[470, 540, 3]],
  "kites-sky": [[560, 370, 3], [820, 780, 1]], // the kite · its string
  "colour-powder": [[580, 680, 2], [560, 400, 2], [650, 180, 1]], // teal · orange · blue
  "fireworks-night": [[350, 250, 3]],
  "sweets-box": [[530, 430, 3], [580, 860, 1]], // laddus · the red sleeve
  // college
  "notebook-pen": [[330, 600, 3], [290, 200, 1]], // pen · mug
  "college-canteen": [[550, 500, 3], [100, 100, 1]], // the bowl · spoon
  "backpack-desk": [[450, 450, 2], [560, 800, 2]], // the bag · the flower pocket
  "cricket-gully": [[340, 180, 2], [620, 950, 2], [940, 800, 1], [420, 500, 1]], // cap · ball · stumps · batter
  "phone-charging": [[380, 500, 3], [180, 250, 1]], // the screen · cable
  // travel
  "bus-window-dusk": [[380, 450, 2], [830, 760, 1], [850, 400, 1], [730, 910, 1]], // towers · bus · hill · van
  "goa-beach": [[350, 250, 2], [750, 850, 2], [670, 600, 1]], // palm · waves · waterfall
  "snow-mountains": [[300, 500, 3], [550, 200, 1]], // peak · clouds
  "backwater-boat": [[480, 350, 2], [500, 500, 1], [900, 400, 1]], // man with the fish · boat · woman in blue
  "bicycle-lane": [[420, 580, 2], [520, 920, 2], [590, 300, 1]], // bicycle · the light · seat shadow
  // gold (one clear subject each)
  "gold-cat": [[370, 310, 3], [700, 500, 1]], // eyes · body
  "gold-banana": [[500, 560, 3]],
  "gold-elephant": [[480, 400, 3], [350, 700, 1]], // head · trunk
  "gold-clock": [[500, 250, 3], [500, 700, 1]], // face · pendulum
  "gold-peacock": [[690, 440, 3], [250, 250, 1]], // head · feather eyes
  "gold-tree": [[480, 400, 3], [500, 800, 1]], // tree · tulips
  "gold-moon": [[530, 500, 3]],
  "gold-car": [[500, 600, 2], [480, 380, 1]], // body · window
};
