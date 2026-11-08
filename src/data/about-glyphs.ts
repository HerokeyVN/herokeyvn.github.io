export const ABOUT_TRACE_WORDS = ["USERS", "DON'T", "SEE."] as const;

export const ABOUT_GLYPHS: Record<string, { advance: number; contours: string[] }> = {
  U: { advance: 881, contours: ["M671-286L671-286L671-647L804-647L804-272Q804-208 785.50-160Q767-112 733-79Q699-46 653.50-25.50Q608-5 554.50 4Q501 13 442 13L442 13Q381 13 326 4Q271-5 225.50-25.50Q180-46 147-79Q114-112 95.50-160Q77-208 77-272L77-272L77-647L210-647L210-286Q210-210 240-170.50Q270-131 322.50-116.50Q375-102 442-102L442-102Q507-102 558.50-116.50Q610-131 640.50-170.50Q671-210 671-286Z"] },
  S: { advance: 694, contours: ["M34-218L34-218L169-218Q173-184 200.50-156.50Q228-129 273-113.50Q318-98 374-98L374-98Q425-98 458-109Q491-120 507-140Q523-160 523-188L523-188Q523-215 503-229.50Q483-244 440-253.50Q397-263 327-273L327-273Q272-281 223-295.50Q174-310 136.50-333Q99-356 77.50-389.50Q56-423 56-469L56-469Q56-526 88.50-569Q121-612 185-636Q249-660 342-660L342-660Q482-660 557.50-600.50Q633-541 631-437L631-437L501-437Q497-496 451.50-522Q406-548 337-548L337-548Q273-548 231.50-529Q190-510 190-464L190-464Q190-446 200-432.50Q210-419 234-409Q258-399 299-390Q340-381 401-372L401-372Q458-364 504.50-350.50Q551-337 584.50-315.50Q618-294 636-261Q654-228 654-180L654-180Q654-121 623.50-77.50Q593-34 529.50-10Q466 14 365 14L365 14Q293 14 238-1.50Q183-17 143-43Q103-69 78-100Q53-131 42.50-162Q32-193 34-218Z"] },
  E: { advance: 769, contours: ["M618-270L210-270L210-111L709-111L709 0L77 0L77-647L708-647L708-536L210-536L210-375L618-375L618-270Z"] },
  R: { advance: 826, contours: ["M210 0L77 0L77-647L516-647Q591-647 646.50-626.50Q702-606 733-562.50Q764-519 764-451L764-451Q764-405 748-373Q732-341 703.50-321Q675-301 638-291L638-291Q621-286 602-282L602-282Q635-279 660-274L660-274Q705-263 727.50-235.50Q750-208 750-154L750-154L750 0L617 0L617-145Q617-182 604-202.50Q591-223 557.50-231Q524-239 461-239L461-239L210-239L210 0Z", "M210-533L210-343L516-343Q572-343 601.50-370Q631-397 631-443L631-443Q631-487 601.50-510Q572-533 516-533L516-533L210-533Z"] },
  D: { advance: 879, contours: ["M77-647L447-647Q556-647 629-621Q702-595 745.50-550.50Q789-506 807.50-448Q826-390 826-326L826-326Q826-262 805.50-203Q785-144 740.50-98.50Q696-53 623.50-26.50Q551 0 447 0L447 0L77 0L77-647Z", "M210-533L210-114L444-114Q516-114 563.50-131.50Q611-149 639-179Q667-209 679-247Q691-285 691-326L691-326Q691-367 679-404Q667-441 639-470Q611-499 563.50-516Q516-533 444-533L444-533L210-533Z"] },
  O: { advance: 924, contours: ["M462 13L462 13Q333 13 241.50-27.50Q150-68 101.50-143Q53-218 53-323L53-323Q53-429 101.50-504Q150-579 241.50-619.50Q333-660 462-660L462-660Q592-660 683-619.50Q774-579 822.50-504Q871-429 871-323L871-323Q871-218 822.50-143Q774-68 683-27.50Q592 13 462 13Z", "M462-102L462-102Q542-102 602.50-126Q663-150 697.50-199Q732-248 732-323L732-323Q732-398 697.50-447Q663-496 602.50-520.50Q542-545 462-545L462-545Q383-545 321-520.50Q259-496 224-447Q189-398 189-323L189-323Q189-248 224-199Q259-150 321-126Q383-102 462-102Z"] },
  N: { advance: 901, contours: ["M210-647L691-173L691-647L824-647L824 0L691 0L210-470L210 0L77 0L77-647L210-647Z"] },
  M: { advance: 1099, contours: ["M549-115L889-647L1022-647L1022 0L889 0L889-411L624 0L475 0L210-410L210 0L77 0L77-647L210-647Z"] },
  I: { advance: 324, contours: ["M96-647L229-647L229 0L96 0Z"] },
  F: { advance: 741, contours: ["M708-647L708-536L210-536L210-362L618-362L618-258L210-258L210 0L77 0L77-647Z"] },
  A: { advance: 789, contours: ["M17 0L321-647L465-647L772 0L627 0L563-141L225-141L161 0Z", "M512-252L393-513L275-252Z"] },
  C: { advance: 885, contours: ["M832-233Q823-155 777-100Q731-45 652-16Q573 13 464 13Q373 13 297.50-8Q222-29 167.50-71Q113-113 83-175.50Q53-238 53-322Q53-406 83-469Q113-532 167.50-574.50Q222-617 297.50-638.50Q373-660 464-660Q573-660 652.50-630Q732-600 778-544.50Q824-489 832-410L700-410Q687-452 656.50-482.50Q626-513 578-529Q530-545 464-545Q382-545 320-519.50Q258-494 224-444.50Q190-395 190-322Q190-250 224-201Q258-152 320-126.50Q382-101 464-101Q530-101 577.50-117Q625-133 655.50-163Q686-193 700-233Z"] },
  "'": { advance: 230, contours: ["M191-567L149-443L80-443L39-567L39-653L191-653L191-567Z"] },
  T: { advance: 722, contours: ["M20-536L20-647L702-647L702-536L428-536L428 0L295 0L295-536L20-536Z"] },
  ".": { advance: 271, contours: ["M60-114L211-114L211 0L60 0L60-114Z"] },
  // Round 12.1: the letters the three new headline traces need, extracted
  // from the same @fontsource/syne Syne 700 Latin WOFF with the same
  // pipeline as the Round 12 letters above (RecordingPen ops, y negated,
  // qCurveTo expanded with implied midpoints, no duplicates, 1000 upm).
  // Verified byte-identical reproduction of the stored A, C, F, I, M.
  G: { advance: 914, contours: ["M449 13Q359 13 286.50-8Q214-29 161.50-71Q109-113 81-175Q53-237 53-318Q53-400 82.50-463.50Q112-527 166.50-571Q221-615 296.50-637.50Q372-660 464-660Q573-660 652-629.50Q731-599 776.50-544Q822-489 828-413L700-413Q687-453 657.50-482.50Q628-512 580-528.50Q532-545 464-545Q377-545 315.50-517Q254-489 222-438Q190-387 190-318Q190-251 218-202.50Q246-154 304.50-128Q363-102 454-102Q524-102 577.50-120.50Q631-139 667-171Q698-197 713-230L465-230L465-315L851-315L851 0L736 0Q736-31 740-71.50Q744-112 750-154Q752-169 754-183Q730-108 673-59Q588 13 449 13Z"] },
  B: { advance: 780, contours: ["M77 0L77-647L450-647Q580-647 647.50-603.50Q715-560 715-474Q715-419 688-387.50Q661-356 612-341Q582-332 545-327Q569-325 592-322Q635-316 668-300Q701-284 720-255.50Q739-227 739-181Q739-121 707-81.50Q675-42 618-22Q561-2 486 0Z", "M210-110L472-110Q535-110 569-130.50Q603-151 603-196Q603-229 583-244Q563-259 530-262.50Q497-266 459-266L210-266Z", "M210-373L445-373Q508-373 542-391.50Q576-410 576-455Q576-500 542-518.50Q508-537 452-537L210-537Z"] },
  L: { advance: 687, contours: ["M210-647L210-111L640-111L640 0L77 0L77-647Z"] },
  W: { advance: 1300, contours: ["M293 0L20-647L167-647L376-128L575-647L728-647L927-128L1136-647L1280-647L1010 0L847 0L652-507L456 0Z"] },
  H: { advance: 895, contours: ["M685-647L818-647L818 0L685 0L685-269L210-269L210 0L77 0L77-647L210-647L210-380L685-380Z"] },
  Y: { advance: 740, contours: ["M721-647L437-204L437 0L303 0L303-204L19-647L173-647L372-325L567-647Z"] },
  P: { advance: 784, contours: ["M208-210L208 0L75 0L75-647L476-647Q530-647 577.50-634Q625-621 660.50-594Q696-567 716-525Q736-483 736-424Q736-366 716-325Q696-284 660.50-258.50Q625-233 577.50-221.50Q530-210 476-210Z", "M208-316L488-316Q541-316 572-344.50Q603-373 603-424Q603-477 572-505Q541-533 488-533L208-533Z"] },
};

export const ABOUT_GLYPH_INSTANCES = ABOUT_TRACE_WORDS.flatMap((word, wordIndex) =>
  [...word].map((char, charIndex) => ({ key: `${wordIndex}-${charIndex}`, char, contours: ABOUT_GLYPHS[char]!.contours })),
);

export type AnchorPreference = {
  mode: "top" | "right" | "bottom" | "left" | "fraction";
  fraction?: number;
};

export type JunctionPreference = AnchorPreference;

export type GlyphTransition = {
  from: string;
  to: string;
  visibility: "visible" | "hidden";
  fromAnchor?: AnchorPreference;
  toAnchor?: AnchorPreference;
  desktop?: boolean;
  mobile?: boolean;
};

export const GLYPH_TRANSITIONS: GlyphTransition[] = [
  // Pair 1 in USERS: R (0-3) -> E (0-2) across the inter-letter gap
  {
    from: "0-3",
    to: "0-2",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 8 / 120 },  // R left spine at y ~ -80
    toAnchor: { mode: "fraction", fraction: 30 / 120 },   // E bottom arm right edge at y ~ -84.5
    desktop: true,
    mobile: true,
  },
  // Pair 2 in DON'T:
  // Desktop RTL: N (1-2) -> O (1-1)
  {
    from: "1-2",
    to: "1-1",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 107 / 120 }, // N left spine at y ~ -334
    toAnchor: { mode: "fraction", fraction: 90 / 120 },    // O right belly at y ~ -323
    desktop: true,
    mobile: false,
  },
  // Mobile LTR: O (1-1) -> N (1-2)
  {
    from: "1-1",
    to: "1-2",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 90 / 120 },   // O right belly at y ~ -323
    toAnchor: { mode: "fraction", fraction: 107 / 120 },   // N left spine at y ~ -334
    desktop: false,
    mobile: true,
  },
  // Pair 3 in SEE.: E1 (2-1) -> E2 (2-2) across the double-E gap
  {
    from: "2-1",
    to: "2-2",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 30 / 120 },  // E1 bottom arm right edge at y ~ -84.5
    toAnchor: { mode: "fraction", fraction: 52 / 120 },   // E2 left spine at y ~ -84.67
    desktop: true,
    mobile: true,
  },
  // Single-line desktop RTL fallback for SEE.: E2 (2-2) -> E1 (2-1)
  {
    from: "2-2",
    to: "2-1",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 52 / 120 }, // E2 left spine at y ~ -84.67
    toAnchor: { mode: "fraction", fraction: 30 / 120 },   // E1 bottom arm right edge at y ~ -84.5
    desktop: true,
    mobile: false,
  },
];

export function findTransition(fromKey: string, toKey: string, isMobile: boolean): GlyphTransition | undefined {
  return GLYPH_TRANSITIONS.find((t) => {
    if (t.from !== fromKey || t.to !== toKey) return false;
    if (isMobile && t.mobile === false) return false;
    if (!isMobile && t.desktop === false) return false;
    return true;
  });
}

// Round 12: the outlined Experience headline ("meets infrastructure.") is
// traced the same way as the About glyphs. Keys are "exp-{word}-{char}";
// the words are the em's words in reading order. M, I, F, A, C contours
// were extracted from the same @fontsource/syne Syne 700 Latin WOFF as
// the About contours (fontTools SVGPathPen, y negated, 1000 units per em);
// every other letter reuses the About contour above.
export const EXP_TRACE_WORDS = ["MEETS", "INFRASTRUCTURE."] as const;

export const EXP_GLYPH_INSTANCES = EXP_TRACE_WORDS.flatMap((word, wordIndex) =>
  [...word].map((char, charIndex) => ({ key: `exp-${wordIndex}-${charIndex}`, char, contours: ABOUT_GLYPHS[char]!.contours })),
);

// Round 12.1: the three new headline traces (Projects "TANGIBLE.", Skills
// "USED WITH INTENT.", Contact "YOUR PRODUCT NEEDS."). Words are already
// split on spaces, so no space character ever gets a span or a contour -
// the trace skips the gaps between words with hidden travel, exactly as
// the About/Experience traces skip unlisted inter-letter pairs. No
// visible transitions are defined for these three headlines: every
// inter-letter hop is hidden, so no glyph-connector element is created
// for them (findTransition is left unset in their trace configs).
const instancesFor = (prefix: string, words: readonly string[]) =>
  words.flatMap((word, wordIndex) =>
    [...word].map((char, charIndex) => ({ key: `${prefix}-${wordIndex}-${charIndex}`, char, contours: ABOUT_GLYPHS[char]!.contours })),
  );

export const PROJ_TRACE_WORDS = ["TANGIBLE."] as const;
export const PROJ_GLYPH_INSTANCES = instancesFor("proj", PROJ_TRACE_WORDS);

export const SKILLS_TRACE_WORDS = ["USED", "WITH", "INTENT."] as const;
export const SKILLS_GLYPH_INSTANCES = instancesFor("skills", SKILLS_TRACE_WORDS);

export const CONTACT_TRACE_WORDS = ["YOUR", "PRODUCT", "NEEDS."] as const;
export const CONTACT_GLYPH_INSTANCES = instancesFor("contact", CONTACT_TRACE_WORDS);

export const EXP_GLYPH_TRANSITIONS: GlyphTransition[] = [
  // Pair 1 in MEETS: E (exp-0-1) -> E (exp-0-2), same side points as the
  // About double-E pair (bottom arm right edge -> left spine, y ~ -84).
  {
    from: "exp-0-1",
    to: "exp-0-2",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 30 / 120 },
    toAnchor: { mode: "fraction", fraction: 52 / 120 },
    desktop: true,
    mobile: true,
  },
  // Pair 2 in INFRASTRUCTURE.: N (exp-1-1) -> F (exp-1-2), right spine ->
  // left spine at y ~ -320 (fractions measured from the flattened
  // contours: N (824, -321), F (77, -316)).
  {
    from: "exp-1-1",
    to: "exp-1-2",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 0.3906 },
    toAnchor: { mode: "fraction", fraction: 0.7147 },
    desktop: true,
    mobile: true,
  },
  // Pair 3 in INFRASTRUCTURE.: R (exp-1-3) -> A (exp-1-4), bowl right ->
  // left leg at y ~ -451 (R (764, -451), A (226.8, -446.5)).
  {
    from: "exp-1-3",
    to: "exp-1-4",
    visibility: "visible",
    fromAnchor: { mode: "fraction", fraction: 0.4939 },
    toAnchor: { mode: "fraction", fraction: 0.1964 },
    desktop: true,
    mobile: true,
  },
];

export function findExpTransition(fromKey: string, toKey: string, isMobile: boolean): GlyphTransition | undefined {
  return EXP_GLYPH_TRANSITIONS.find((t) => {
    if (t.from !== fromKey || t.to !== toKey) return false;
    if (isMobile && t.mobile === false) return false;
    if (!isMobile && t.desktop === false) return false;
    return true;
  });
}

// Round 12: the site-1 exit leaves from the last traced glyph's top-right
// corner, so the contour departure heads straight down. Which glyph is
// last depends on the rendered line count: "." (2-3) on two/three lines,
// "U" (0-0) when the whole phrase fits one line (1280). "." perimeter is
// 530 units with the corner 151 along; "U" perimeter is ~3472.1 units
// with its right-stem top corner 494 along.
export const ABOUT_EXIT_JUNCTION_FRACTIONS: Record<string, number> = {
  "2-3": 151 / 530,
  "0-0": 494 / 3472.12,
};
