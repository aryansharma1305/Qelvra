import type { Page } from "@playwright/test";
import edits from "./beta-copy-edits.json" with { type: "json" };
// Approved PR17 truth corrections only. Original exports and mismatch budget are unchanged.
export async function prepareBetaReference(page: Page, route: string) {
  const section =
    route === "/" ? "home" : route.startsWith("/agents/new") ? "create-agent" : route.split("/")[1];
  const filtered = edits.filter(
    (e) =>
      e.file.startsWith(`pages/${section}/`) ||
      (e.file === "components/shell/AppHeader.tsx" && section !== "onboarding") ||
      (e.file === "mocks/agents.tsx" && ["home", "swarm"].includes(section ?? "")),
  );
  await page.evaluate(
    ({ filtered, section }) => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName ?? "")) continue;
        const text = normalize(node.textContent ?? "");
        const edit = filtered.find(
          (e) =>
            !("kind" in e) &&
            (!e.scope || node?.parentElement?.closest(e.scope)) &&
            normalize(e.from) === text,
        );
        if (edit) node.textContent = (node.textContent ?? "").replace(/\S[\s\S]*\S|\S/, edit.to);
      }
      for (const input of document.querySelectorAll<HTMLInputElement>("input[placeholder]")) {
        const edit = filtered.find((e) => normalize(e.from) === normalize(input.placeholder));
        if (edit) input.placeholder = edit.to;
      }
      for (const edit of filtered.filter((e) => "kind" in e))
        for (const el of document.querySelectorAll<HTMLElement>("[class]"))
          if ((!edit.scope || el.closest(edit.scope)) && el.classList.contains(edit.from)) {
            el.classList.remove(edit.from);
            el.classList.add(edit.to);
          }
      if (
        ["home", "swarm", "network", "studio", "onboarding", "terminal"].includes(section ?? "")
      ) {
        for (const el of document.querySelectorAll<HTMLElement>("[style]"))
          if (el.style.width.endsWith("%") && el.style.width !== "0%") el.style.width = "0%";
      }
      // Owner-approved blocker cleanup (docs/release/pr17-blocker-cleanup.md).
      // Render the same intentional control states; do not mask these changes.
      const removeArrows = (root: Element) => {
        for (const el of root.querySelectorAll(".material-symbols-outlined"))
          if (["arrow_drop_down", "expand_more"].includes(normalize(el.textContent ?? "")))
            el.remove();
      };
      for (const header of document.querySelectorAll("body > header")) {
        removeArrows(header);
        for (const el of header.querySelectorAll("div"))
          if (normalize(el.textContent ?? "").includes("Local workspace"))
            el.classList.remove("cursor-pointer", "hover:text-on-surface");
      }
      if (section === "home") {
        for (const button of document.querySelectorAll<HTMLButtonElement>("main button"))
          if (
            ["attach_file", "graphic_eq"].some((icon) =>
              normalize(button.textContent ?? "").includes(icon),
            )
          ) {
            button.disabled = true;
            button.classList.add("disabled:opacity-50", "disabled:cursor-not-allowed");
          }
        for (const span of document.querySelectorAll("span")) {
          const text = normalize(span.textContent ?? "");
          if (text.startsWith("Project:") || text.startsWith("Orchestrator:")) {
            const chip = span.parentElement;
            if (chip) {
              removeArrows(chip);
              chip.classList.remove(
                "hover:bg-surface-container-high",
                "hover:text-on-surface",
                "transition-all",
                "duration-150",
              );
            }
          }
        }
      }
      if (section === "studio") {
        for (const selector of [
          "#viewBtnStudio",
          "#viewBtnCommand",
          "#perspIso",
          "#perspOrtho",
          "#playAudioBtn",
          'input[type="range"]',
        ]) {
          const el = document.querySelector<HTMLButtonElement | HTMLInputElement>(selector);
          if (el) {
            el.disabled = true;
            if (el.tagName === "BUTTON")
              el.classList.add("disabled:opacity-50", "disabled:cursor-not-allowed");
          }
        }
        const audioBar = document.querySelector("#playAudioBtn")?.parentElement?.parentElement;
        audioBar?.classList.remove("h-12");
        audioBar?.classList.add("min-h-12", "py-2");
        for (const button of document.querySelectorAll(".zone-pill")) {
          const label = document.createElement("span");
          label.className = "zone-pill px-2.5 py-1 text-on-surface-variant text-xs";
          label.textContent = button.textContent;
          button.replaceWith(label);
        }
        for (const el of document.querySelectorAll("span"))
          if (normalize(el.textContent ?? "") === "Zones:") el.textContent = "Sample zones:";
        for (const el of document.querySelectorAll("strong"))
          if (["Healthy", "Optimal"].includes(normalize(el.textContent ?? "")))
            el.textContent = "Not measured";
      }
      if (section === "create-agent") {
        for (const el of document.querySelectorAll("div"))
          if (
            normalize(el.textContent ?? "") ===
            "Coming later. Goals assign registered agents after you approve a plan."
          ) {
            el.textContent =
              "Per-agent autonomous delegation is planned for a future release. Goals still coordinate agents after you approve a plan.";
          }
      }
      if (section === "onboarding") {
        for (const input of document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
          input.checked = false;
          input.disabled = true;
        }
      }
      if (["swarm", "network", "studio", "onboarding"].includes(section ?? "")) {
        const note = document.createElement("p");
        note.setAttribute("role", "note");
        note.className =
          "fixed bottom-4 right-4 left-16 sm:left-auto z-50 max-w-sm bg-surface-container-high text-on-surface border border-outline-variant p-3 rounded-lg font-body-sm text-body-sm";
        note.textContent =
          "Coming later — visual preview. Sample cards show no live work. Create real agents and tasks from the sidebar.";
        document.body.append(note);
      }
    },
    { filtered, section },
  );
  // The Play CDN observes these DOM edits and rebuilds reference styles asynchronously.
  // Measure the reference only after its updated styles and fonts have rendered.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await document.fonts.ready;
  });
}
