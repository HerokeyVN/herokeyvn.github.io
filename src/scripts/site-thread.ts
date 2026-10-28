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
  let cumulativeLengths: number[] = [0];
  let scrollMilestones: number[] = [0, 0, 0, 0, 0, 0];
  let resizeFrame = 0;
  let trigger: ScrollTrigger | undefined;

  const topOf = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector);
    return element ? element.getBoundingClientRect().top + scrollY : 0;
  };

  const botOf = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector);
    return element ? element.getBoundingClientRect().bottom + scrollY : 0;
  };

  const computeTargetDistance = (currentScroll: number): number => {
    const firstMilestone = scrollMilestones[0] ?? 0;
    const lastMilestone = scrollMilestones[5] ?? 0;
    if (currentScroll <= firstMilestone) return 0;
    if (currentScroll >= lastMilestone) return totalLength;

    for (let i = 0; i < 5; i++) {
      const sStart = scrollMilestones[i] ?? 0;
      const sEnd = scrollMilestones[i + 1] ?? 0;
      if (currentScroll >= sStart && currentScroll <= sEnd) {
        const span = sEnd - sStart;
        const progress = span > 0 ? (currentScroll - sStart) / span : 0;
        const distStart = cumulativeLengths[i] ?? 0;
        const distEnd = cumulativeLengths[i + 1] ?? totalLength;
        return distStart + progress * (distEnd - distStart);
      }
    }

    return totalLength;
  };

  const render = (currentScroll: number) => {
    if (!totalLength) return;

    if (reduceMotion.matches) {
      segments.forEach(({ element }) => {
        gsap.set(element, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" });
      });
      gsap.set(end, { autoAlpha: 0 });
      return;
    }

    const targetDistance = computeTargetDistance(currentScroll);
    let remaining = targetDistance;
    let activeElement: SVGPathElement | undefined;
    let activeDistance = 0;

    segments.forEach(({ element, length }, index) => {
      const visible = Math.max(0, Math.min(length, remaining));
      gsap.set(element, {
        strokeDasharray: `${length} ${length}`,
        strokeDashoffset: length - visible,
        visibility: visible > 0 ? "visible" : "hidden",
      });

      if (visible > 0 && visible < length) {
        activeElement = element;
        activeDistance = visible;
      } else if (visible >= length && index === segments.length - 1 && targetDistance >= totalLength) {
        activeElement = element;
        activeDistance = length;
      }
      remaining -= length;
    });

    if (activeElement && targetDistance > 0) {
      const point = activeElement.getPointAtLength(activeDistance);
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
    const winHeight = window.innerHeight;

    const heroHeight = document.querySelector<HTMLElement>("#top")?.offsetHeight ?? winHeight;
    const aboutTop = topOf("#about");
    const expTop = topOf("#experience");
    const projTop = topOf("#projects");
    const skillsTop = topOf("#skills");
    const contactTop = topOf("#contact");

    const edge = Math.max(6, Math.min(18, width * 0.014));

    // Measure About crossover gap
    const stmt = document.querySelector(".about__statement");
    const prof = document.querySelector(".about__profile");
    const gapTop = stmt ? botOf(".about__statement") : aboutTop + 400;
    const gapBot = prof ? topOf(".about__profile") : aboutTop + 650;
    const crossY = (gapTop + gapBot) / 2;

    // Measure Projects inter-card gaps
    const p1 = document.querySelector("#fb-messenger-e2ee");
    const p2 = document.querySelector("#sky-sheet-store");
    const p3 = document.querySelector("#sky-auto-piano");
    const p1Bot = p1 ? botOf("#fb-messenger-e2ee") : projTop + 600;
    const p2Top = p2 ? topOf("#sky-sheet-store") : projTop + 700;
    const p2Bot = p2 ? botOf("#sky-sheet-store") : projTop + 1600;
    const p3Top = p3 ? topOf("#sky-auto-piano") : projTop + 1700;

    const projGap1Y = (p1Bot + p2Top) / 2;
    const projGap2Y = (p2Bot + p3Top) / 2;

    // Measure Contact anchor
    const emailBtn = document.querySelector(".contact__email-btn");
    const emailBox = emailBtn?.getBoundingClientRect();
    const contactTargetX = emailBox ? Math.max(edge, emailBox.left - 24) : width * 0.25;
    const contactTargetY = emailBox ? emailBox.top + scrollY + emailBox.height / 2 : contactTop + 300;

    // Start point: matches Hero thread exit point (width * 0.79, heroHeight)
    const startX = width * (1138 / 1440);
    const startY = heroHeight;

    const seg0 = [
      `M ${startX} ${startY}`,
      `C ${width - edge} ${startY + 20}, ${width - edge} ${startY + 50}, ${width - edge} ${startY + 70}`,
      `C ${width - edge} ${gapTop - 40}, ${width - edge} ${gapTop - 20}, ${width - edge} ${gapTop}`,
      `C ${width - edge} ${crossY}, ${edge} ${crossY}, ${edge} ${gapBot}`,
      `C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`,
    ].join(" ");

    const seg1 = [
      `M ${edge} ${expTop}`,
      `C ${edge * 0.6} ${expTop + (projTop - expTop) * 0.3}, ${edge * 0.6} ${expTop + (projTop - expTop) * 0.7}, ${edge} ${projTop}`,
    ].join(" ");

    const seg2 = [
      `M ${edge} ${projTop}`,
      `C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot}`,
      `C ${edge} ${projGap1Y}, ${width - edge} ${projGap1Y}, ${width - edge} ${p2Top}`,
      `C ${width - edge} ${p2Bot - 40}, ${width - edge} ${p2Bot - 10}, ${width - edge} ${p2Bot}`,
      `C ${width - edge} ${projGap2Y}, ${edge} ${projGap2Y}, ${edge} ${p3Top}`,
      `C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
    ].join(" ");

    const seg3 = [
      `M ${edge} ${skillsTop}`,
      `C ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.3}, ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.7}, ${edge} ${contactTop}`,
    ].join(" ");

    const seg4 = [
      `M ${edge} ${contactTop}`,
      `C ${edge} ${contactTop + 100}, ${contactTargetX - 60} ${contactTargetY - 40}, ${contactTargetX} ${contactTargetY}`,
    ].join(" ");

    const pathData = [seg0, seg1, seg2, seg3, seg4];

    segments = paths.map((element, index) => {
      element.setAttribute("d", pathData[index] ?? "");
      return { element, length: element.getTotalLength() };
    });

    totalLength = segments.reduce((sum, s) => sum + s.length, 0);

    // Compute cumulative distance milestones
    cumulativeLengths = [0];
    let acc = 0;
    segments.forEach((s) => {
      acc += s.length;
      cumulativeLengths.push(acc);
    });

    // Compute scroll milestones for direct authoritative synchronization
    const s0 = Math.round(heroHeight * 0.55);
    const s1 = Math.max(s0 + 60, Math.round(expTop - winHeight * 0.55));
    const s2 = Math.max(s1 + 60, Math.round(projTop - winHeight * 0.55));
    const s3 = Math.max(s2 + 60, Math.round(skillsTop - winHeight * 0.55));
    const s4 = Math.max(s3 + 60, Math.round(contactTop - winHeight * 0.55));
    const s5 = Math.max(s4 + 60, height - winHeight);

    scrollMilestones = [s0, s1, s2, s3, s4, s5];

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;

    render(window.scrollY);
  };

  const scheduleBuild = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(build);
  };

  const onScroll = () => {
    render(window.scrollY);
  };

  const observer = new ResizeObserver(scheduleBuild);

  document.fonts.ready.then(() => {
    build();

    trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 0,
      end: "bottom bottom",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: () => render(window.scrollY),
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    document.querySelectorAll<HTMLElement>("main > section, #contact").forEach((section) => observer.observe(section));
    ScrollTrigger.refresh();
  });

  reduceMotion.addEventListener("change", scheduleBuild);

  return () => {
    cancelAnimationFrame(resizeFrame);
    observer.disconnect();
    trigger?.kill();
    window.removeEventListener("scroll", onScroll);
    reduceMotion.removeEventListener("change", scheduleBuild);
  };
}
