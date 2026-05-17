/** Figma Side Bar mockup collage (node 8882:164729 / Group 22). */
export const AUTH_ASIDE_MOCKUP_CANVAS = {
  width: 1773,
  height: 1670,
  /** Scales the 1773px-wide collage to fill the aside while keeping Figma positions. */
  scale: 1.04,
  /** Rasterize transforms at 2× then scale down for sharper text on retina displays. */
  renderScale: 2,
} as const;

/** Native mockup export size (1024×681 minus bottom crop). */
export const AUTH_ASIDE_MOCKUP_IMAGE = {
  width: 1024,
  height: 678,
} as const;

/** Five staggered rows × three cards. */
export const AUTH_ASIDE_MOCKUP_ROWS = [
  {
    screens: [
      "/auth-aside/mockup-01.png",
      "/auth-aside/mockup-02.png",
      "/auth-aside/mockup-03.png",
    ],
    positionClassName: "left-[calc(50%+120px)] top-[-29px]",
  },
  {
    screens: [
      "/auth-aside/mockup-04.png",
      "/auth-aside/mockup-05.png",
      "/auth-aside/mockup-06.png",
    ],
    positionClassName: "left-[calc(50%-160px)] top-[314.44px]",
  },
  {
    screens: [
      "/auth-aside/mockup-10.png",
      "/auth-aside/mockup-11.png",
      "/auth-aside/mockup-12.png",
    ],
    positionClassName: "left-[calc(50%+80px)] top-[657.87px]",
  },
  {
    screens: [
      "/auth-aside/mockup-07.png",
      "/auth-aside/mockup-08.png",
      "/auth-aside/mockup-09.png",
    ],
    positionClassName: "left-[calc(50%-160px)] top-[1001.31px]",
  },
  {
    screens: [
      "/auth-aside/mockup-13.png",
      "/auth-aside/mockup-14.png",
      "/auth-aside/mockup-15.png",
    ],
    positionClassName: "left-[calc(50%+120px)] top-[1344.74px]",
  },
] as const;
