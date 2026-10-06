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
