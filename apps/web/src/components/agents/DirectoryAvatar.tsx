import type { AgentId } from "@qelvra/shared";

// Per-agent avatar artwork from the Stitch directory design.
// Agents with other ids get the default glyph. TODO(PR 13): chosen or generated avatars.
export function DirectoryAvatar({ agentId }: { agentId: AgentId }) {
  switch (agentId) {
    case "michael":
      return (
        <svg
          className="w-10 h-10 transform group-hover:scale-105 transition-transform duration-500"
          viewBox="0 0 100 100"
        >
          {" "}
          <circle
            cx="50"
            cy="50"
            fill="#131315"
            r="38"
            stroke="#a078ff"
            strokeDasharray="4 3"
            strokeWidth="3"
          />{" "}
          <polygon
            fill="#a078ff"
            fillOpacity="0.3"
            points="50 20, 76 65, 24 65"
            stroke="#d0bcff"
            strokeWidth="2"
          />{" "}
          <circle cx="50" cy="20" fill="#d0bcff" r="4" />{" "}
          <circle cx="76" cy="65" fill="#d0bcff" r="4" />{" "}
          <circle cx="24" cy="65" fill="#d0bcff" r="4" />{" "}
          <circle className="animate-pulse" cx="50" cy="50" fill="#f8fafc" r="6" />{" "}
        </svg>
      );
    case "atlas":
      return (
        <svg
          className="w-10 h-10 transform group-hover:scale-110 transition-transform duration-500"
          viewBox="0 0 100 100"
        >
          {" "}
          <rect
            fill="#131315"
            height="60"
            rx="10"
            stroke="#03b5d3"
            strokeWidth="3"
            width="60"
            x="20"
            y="20"
          />{" "}
          <line
            stroke="#acedff"
            strokeDasharray="3 3"
            strokeWidth="2"
            x1="20"
            x2="80"
            y1="50"
            y2="50"
          />{" "}
          <line
            stroke="#acedff"
            strokeDasharray="3 3"
            strokeWidth="2"
            x1="50"
            x2="50"
            y1="20"
            y2="80"
          />{" "}
          <circle cx="50" cy="50" fill="#4cd7f6" r="8" />{" "}
        </svg>
      );
    case "pixel":
      return (
        <svg
          className="w-10 h-10 transform group-hover:rotate-45 transition-transform duration-700"
          viewBox="0 0 100 100"
        >
          {" "}
          <defs>
            {" "}
            <linearGradient id="prismGrad" x1="0%" x2="100%" y1="0%" y2="100%">
              {" "}
              <stop offset="0%" stopColor="#4cd7f6" /> <stop offset="50%" stopColor="#d0bcff" />{" "}
              <stop offset="100%" stopColor="#4edea3" />{" "}
            </linearGradient>{" "}
          </defs>{" "}
          <polygon
            fill="url(#prismGrad)"
            fillOpacity="0.35"
            points="50 15, 85 80, 15 80"
            stroke="#d0bcff"
            strokeWidth="2"
          />{" "}
          <polygon fill="#131315" points="50 35, 70 75, 30 75" stroke="#acedff" strokeWidth="1.5" />{" "}
          <circle cx="50" cy="58" fill="#6ffbbe" r="4" />{" "}
        </svg>
      );
    case "scout":
      return (
        <svg
          className="w-10 h-10 transform group-hover:scale-105 transition-transform duration-500"
          viewBox="0 0 100 100"
        >
          {" "}
          <polygon
            fill="#131315"
            points="50 10, 88 32, 88 78, 50 100, 12 78, 12 32"
            stroke="#ffb4ab"
            strokeWidth="2"
          />{" "}
          <polygon
            fill="#93000a"
            fillOpacity="0.25"
            points="50 25, 75 40, 75 70, 50 85, 25 70, 25 40"
            stroke="#4cd7f6"
            strokeWidth="2"
          />{" "}
          <circle className="animate-ping" cx="50" cy="55" fill="#ffb4ab" r="5" />{" "}
        </svg>
      );
    case "echo":
      return (
        <svg className="w-10 h-10" viewBox="0 0 100 100">
          {" "}
          <circle cx="50" cy="50" fill="#131315" r="38" stroke="#958ea0" strokeWidth="2" />{" "}
          <line
            stroke="#cbc3d7"
            strokeLinecap="round"
            strokeWidth="3"
            x1="25"
            x2="25"
            y1="50"
            y2="50"
          />{" "}
          <line
            stroke="#cbc3d7"
            strokeLinecap="round"
            strokeWidth="3"
            x1="37"
            x2="37"
            y1="40"
            y2="60"
          />{" "}
          <line
            stroke="#cbc3d7"
            strokeLinecap="round"
            strokeWidth="3"
            x1="50"
            x2="50"
            y1="30"
            y2="70"
          />{" "}
          <line
            stroke="#cbc3d7"
            strokeLinecap="round"
            strokeWidth="3"
            x1="63"
            x2="63"
            y1="42"
            y2="58"
          />{" "}
          <line
            stroke="#cbc3d7"
            strokeLinecap="round"
            strokeWidth="3"
            x1="75"
            x2="75"
            y1="48"
            y2="52"
          />{" "}
        </svg>
      );
    default:
      return (
        <svg
          className="w-10 h-10 transform group-hover:rotate-12 transition-transform duration-500"
          viewBox="0 0 100 100"
        >
          {" "}
          <polygon
            fill="#131315"
            points="50 3, 90 25, 90 75, 50 97, 10 75, 10 25"
            stroke="#4cd7f6"
            strokeOpacity="0.8"
            strokeWidth="4"
          />{" "}
          <polygon
            fill="#03b5d3"
            fillOpacity="0.2"
            points="50 18, 77 34, 77 66, 50 82, 23 66, 23 34"
            stroke="#d0bcff"
            strokeWidth="2"
          />{" "}
          <circle className="animate-pulse" cx="50" cy="50" fill="#acedff" r="10" />{" "}
        </svg>
      );
  }
}
