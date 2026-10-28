import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initMotion() {
  if (typeof window === "undefined") return () => undefined;
  gsap.registerPlugin(ScrollTrigger);

  const media = gsap.matchMedia();
  media.add(
    {
      reduceMotion: "(prefers-reduced-motion: reduce)",
      isMobile: "(max-width: 600px)",
    },
    (context) => {
      const { reduceMotion, isMobile } = context.conditions as { reduceMotion: boolean; isMobile: boolean };

      if (reduceMotion) {
        gsap.set("[data-site-header], [data-hero-meta], [data-identity-line], [data-spatial-aperture], [data-hero-support], [data-reveal]", {
          clearProps: "all",
        });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .from("[data-site-header]", { autoAlpha: 0, y: -10, duration: 0.65 })
        .from("[data-hero-meta]", { autoAlpha: 0, duration: 0.65 }, 0.14)
        .from("[data-identity-line]", { autoAlpha: 0, yPercent: isMobile ? 24 : 18, duration: 1, stagger: 0.1 }, 0.24)
        .from("[data-spatial-aperture]", { autoAlpha: 0, scale: 0.86, duration: 1.1, ease: "power2.out" }, 0.38)
        .from("[data-hero-support]", { autoAlpha: 0, y: 14, duration: 0.65, stagger: 0.08 }, 0.72);

      gsap.to("[data-spatial-aperture]", {
        yPercent: 7,
        scale: 1.04,
        ease: "none",
        scrollTrigger: {
          trigger: "#top",
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          opacity: 0,
          y: element.hasAttribute("data-display-heading") ? 34 : 22,
          duration: element.hasAttribute("data-display-heading") ? 1.05 : 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "clamp(top 88%)",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-project]").forEach((project) => {
        const visual = project.querySelector<HTMLElement>("[data-project-visual]");
        if (!visual) return;
        gsap.from(visual, {
          autoAlpha: 0,
          scale: 0.97,
          y: 24,
          duration: 0.95,
          ease: "power2.out",
          scrollTrigger: {
            trigger: project,
            start: "clamp(top 82%)",
            toggleActions: "play none none reverse",
          },
        });
      });

      document.fonts.ready.then(() => ScrollTrigger.refresh());
    },
  );

  return () => media.revert();
}
