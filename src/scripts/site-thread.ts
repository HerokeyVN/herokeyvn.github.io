import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Segment = { element: SVGPathElement; length: number };

export function initSiteThread() {
  const svg = document.querySelector<SVGSVGElement>("[data-site-thread]");
  const paths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")]
    .sort((a, b) => Number(a.dataset.siteThreadSegment) - Number(b.dataset.siteThreadSegment));
  const end = document.querySelector<SVGCircleElement>("[data-site-thread-end]");
  if (!svg || !paths.length || !end) return () => undefined;

  gsap.registerPlugin(ScrollTrigger);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let segments: Segment[] = [];
  let totalLength = 0;
  let resizeFrame = 0;
  let trigger: ScrollTrigger | undefined;

  const topOf = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector);
    return element ? element.getBoundingClientRect().top + scrollY : 0;
  };

  const render = (progress: number) => {
    if (!totalLength) return;
    if (reduceMotion.matches) {
      gsap.set(paths, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" });
      gsap.set(end, { autoAlpha: 0 });
      return;
    }

    let remaining = totalLength * progress;
    let active: SVGPathElement | undefined;
    let activeDistance = 0;
    segments.forEach(({ element, length }) => {
      const visible = Math.max(0, Math.min(length, remaining));
      gsap.set(element, {
        strokeDasharray: `${length} ${length}`,
        strokeDashoffset: length - visible,
        visibility: visible > 0 ? "visible" : "hidden",
      });
      if (visible > 0 && visible < length) {
        active = element;
        activeDistance = visible;
      }
      remaining -= length;
    });

    if (active) {
      const point = active.getPointAtLength(activeDistance);
      end.setAttribute("cx", String(point.x));
      end.setAttribute("cy", String(point.y));
      gsap.set(end, { autoAlpha: 1 });
    } else {
      gsap.set(end, { autoAlpha: 0 });
    }
  };

  const build = () => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.scrollHeight;
    const heroHeight = document.querySelector<HTMLElement>("#top")?.offsetHeight ?? innerHeight;
    const about = topOf("#about");
    const experience = topOf("#experience");
    const projects = topOf("#projects");
    const skills = topOf("#skills");
    const contact = topOf("#contact");
    const edge = Math.max(12, width * 0.018);

    const pathData = [
      `M ${width * 0.79} ${heroHeight} C ${width * 0.84} ${heroHeight + 36}, ${width - 2} ${about + 38}, ${width - 3} ${about + 170}`,
      `M ${edge} ${experience - 105} C ${edge * 0.45} ${experience - 40}, ${edge * 0.65} ${experience + 22}, ${edge} ${experience + 102}`,
      `M ${width - edge} ${projects - 112} C ${width - edge * 0.45} ${projects - 44}, ${width - edge * 0.65} ${projects + 18}, ${width - edge} ${projects + 98}`,
      `M ${edge} ${skills - 110} C ${edge * 0.45} ${skills - 42}, ${edge * 0.65} ${skills + 20}, ${edge} ${skills + 100}`,
      `M ${edge} ${contact - 108} C ${edge * 0.45} ${contact - 42}, ${edge * 0.65} ${contact + 18}, ${edge} ${contact + 96}`,
    ];

    segments = paths.map((element, index) => {
      element.setAttribute("d", pathData[index] ?? "");
      return { element, length: element.getTotalLength() };
    });
    totalLength = segments.reduce((total, segment) => total + segment.length, 0);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;
    render(trigger?.progress ?? 0);
  };

  const scheduleBuild = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(build);
  };

  const observer = new ResizeObserver(scheduleBuild);
  document.fonts.ready.then(() => {
    build();
    trigger = ScrollTrigger.create({
      trigger: document.body,
      start: () => `${Math.round((document.querySelector<HTMLElement>("#top")?.offsetHeight ?? innerHeight) * 0.62)} top`,
      end: "bottom bottom",
      scrub: 0.55,
      invalidateOnRefresh: true,
      onUpdate: (self) => render(self.progress),
    });
    document.querySelectorAll<HTMLElement>("main > section, #contact").forEach((section) => observer.observe(section));
    ScrollTrigger.refresh();
  });
  reduceMotion.addEventListener("change", scheduleBuild);

  return () => {
    cancelAnimationFrame(resizeFrame);
    observer.disconnect();
    trigger?.kill();
    reduceMotion.removeEventListener("change", scheduleBuild);
  };
}
