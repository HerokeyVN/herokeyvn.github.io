import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ThreadSegment = { element: SVGPathElement; length: number };

export function initHeroThread() {
  const hero = document.querySelector<HTMLElement>("[data-thread-scene='hero']");
  if (!hero) return () => undefined;

  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 601px)",
      mobile: "(max-width: 600px)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { desktop, reduceMotion } = context.conditions as { desktop: boolean; reduceMotion: boolean };
      const selector = desktop ? "[data-thread-segment]" : "[data-thread-segment-mobile]";
      const key = desktop ? "threadSegment" : "threadSegmentMobile";
      const paths = [...hero.querySelectorAll<SVGPathElement>(selector)]
        .sort((a, b) => Number(a.dataset[key]) - Number(b.dataset[key]));

      if (!paths.length) return;
      if (reduceMotion) {
        gsap.set(paths, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" });
        return;
      }

      const segments: ThreadSegment[] = paths.map((element) => ({ element, length: element.getTotalLength() }));
      const totalLength = segments.reduce((total, segment) => total + segment.length, 0);
      const entrance = { progress: 0 };
      let scrollProgress = 0;

      const render = () => {
        let remaining = totalLength * Math.max(entrance.progress, 0.34 + scrollProgress * 0.66);
        segments.forEach(({ element, length }) => {
          const visible = Math.max(0, Math.min(length, remaining));
          gsap.set(element, {
            strokeDasharray: `${length} ${length}`,
            strokeDashoffset: length - visible,
            visibility: visible > 0 ? "visible" : "hidden",
          });
          remaining -= length;
        });
      };

      render();
      const entranceTween = gsap.to(entrance, { progress: 0.34, duration: 1.45, delay: 0.45, ease: "power2.inOut", onUpdate: render });
      const trigger = ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.45,
        onUpdate: (self) => {
          scrollProgress = self.progress;
          render();
        },
      });

      return () => {
        entranceTween.kill();
        trigger.kill();
      };
    },
  );

  return () => media.revert();
}
