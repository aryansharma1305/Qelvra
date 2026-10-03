import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";

/**
 * Link semantics for elements from the Stitch markup that are not anchors (cards, pills,
 * images). Spreading these props keeps the DOM structure, and therefore the visual design,
 * unchanged while making the element navigable by mouse and keyboard.
 */
export function useLinkBehavior(to: string) {
  const navigate = useNavigate();
  return {
    role: "link",
    tabIndex: 0,
    style: { cursor: "pointer" },
    onClick: () => navigate(to),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter") navigate(to);
    },
  } as const;
}
