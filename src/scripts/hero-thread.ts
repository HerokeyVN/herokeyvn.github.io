import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ThreadSegment = { element: SVGPathElement; screenLength: number };

function getScreenLength(path: SVGPathElement, samples = 60): number {
  const matrix = path.getScreenCTM();
  const len = path.getTotalLength();
  let total = 0;
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i <= samples; i++) {
    const pt = path.getPointAtLength((len * i) / samples);
    let sx = pt.x;
    let sy = pt.y;
    if (matrix) {
      sx = pt.x * matrix.a + pt.y * matrix.c + matrix.e;
      sy = pt.x * matrix.b + pt.y * matrix.d + matrix.f;
    }
    if (i > 0) {
      total += Math.hypot(sx - prevX, sy - prevY);
    }
    prevX = sx;
    prevY = sy;
  }
  return total;
}

export function initHeroThread() {
  const hero = document.querySelector<HTMLElement>("[data-thread-scene='hero']");
  if (!hero) return () => undefined;

  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 701px)",
      mobile: "(max-width: 700px)",
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

      paths.forEach((p) => {
        if (!p.getAttribute("pathLength")) p.setAttribute("pathLength", "1");
      });

      let segments: ThreadSegment[] = [];
      let totalLength = 0;

      const measure = () => {
        segments = paths.map((element) => ({ element, screenLength: getScreenLength(element) }));
        totalLength = segments.reduce((total, segment) => total + segment.screenLength, 0);
      };

      measure();

      const entrance = { progress: 0 };
      let scrollProgress = 0;

      const render = () => {
        const effectiveProgress = Math.min(1, Math.max(entrance.progress, 0.35 + scrollProgress * 0.65));
        let remaining = totalLength * effectiveProgress;

        segments.forEach(({ element, screenLength }) => {
          const segProgress = screenLength > 0 ? Math.max(0, Math.min(1, remaining / screenLength)) : 0;
          remaining -= screenLength;

          if (segProgress >= 1) {
            // Completion invariant: remove dash pattern so stretch transforms never clip tail
            gsap.set(element, {
              strokeDasharray: "none",
              strokeDashoffset: 0,
              visibility: "visible",
            });
          } else if (segProgress > 0) {
            gsap.set(element, {
              strokeDasharray: "1 1",
              strokeDashoffset: 1 - segProgress,
              visibility: "visible",
            });
          } else {
            gsap.set(element, {
              strokeDasharray: "1 1",
              strokeDashoffset: 1,
              visibility: "hidden",
            });
          }
        });
      };

      render();
      const entranceTween = gsap.to(entrance, {
        progress: 0.35,
        duration: 1.2,
        delay: 0.3,
        ease: "power2.out",
        onUpdate: render,
      });

      const heroExitScroll = () => Math.round(hero.offsetHeight * 0.55);

      const trigger = ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: () => `${heroExitScroll()} top`,
        scrub: true,
        onUpdate: (self) => {
          if (self.progress > 0 && entranceTween.isActive()) {
            entrance.progress = Math.max(entrance.progress, 0.35);
          }
          scrollProgress = self.progress;
          render();
        },
      });

      const onScroll = () => {
        if (window.scrollY > 0 && entranceTween.isActive()) {
          entrance.progress = Math.max(entrance.progress, 0.35);
        }
        const maxScroll = heroExitScroll();
        scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        render();
      };

      const onResize = () => {
        measure();
        render();
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });

      return () => {
        entranceTween.kill();
        trigger.kill();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      };
    },
  );

  return () => media.revert();
}
