// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import type { KeyboardEvent } from "react";
import type { OperativeKey } from "./studioOperatives";

export function IsometricScene({
  onSelectOperative,
}: {
  onSelectOperative: (operative: OperativeKey) => void;
}) {
  const zoneProps = (operative: OperativeKey) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": `Inspect ${operative}`,
    onClick: () => onSelectOperative(operative),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelectOperative(operative);
      }
    },
  });

  return (
    <svg
      className="w-full h-full drop-shadow-2xl overflow-visible"
      viewBox="0 0 1000 640"
      xmlns="http://www.w3.org/2000/svg"
    >
      {" "}
      <defs>
        {" "}
        <linearGradient id="floorGrad" x1="0%" x2="100%" y1="0%" y2="100%">
          {" "}
          <stop offset="0%" stopColor="#1c1b1d" stopOpacity="0.95" />{" "}
          <stop offset="100%" stopColor="#131315" stopOpacity="0.98" />{" "}
        </linearGradient>{" "}
        <linearGradient id="podiumGrad" x1="0%" x2="100%" y1="0%" y2="100%">
          {" "}
          <stop offset="0%" stopColor="#2a2a2c" /> <stop offset="100%" stopColor="#1c1b1d" />{" "}
        </linearGradient>{" "}
        <linearGradient id="violetGlow" x1="0%" x2="100%" y1="0%" y2="100%">
          {" "}
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />{" "}
          <stop offset="100%" stopColor="#340080" stopOpacity="0.1" />{" "}
        </linearGradient>{" "}
        <linearGradient id="cyanGlow" x1="0%" x2="100%" y1="0%" y2="100%">
          {" "}
          <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.7" />{" "}
          <stop offset="100%" stopColor="#004e5c" stopOpacity="0.1" />{" "}
        </linearGradient>{" "}
        <filter height="140%" id="glowSubtle" width="140%" x="-20%" y="-20%">
          {" "}
          <feGaussianBlur result="blur" stdDeviation="4" />{" "}
          <feComposite in="SourceGraphic" in2="blur" operator="over" />{" "}
        </filter>{" "}
        <filter height="160%" id="intensePulse" width="160%" x="-30%" y="-30%">
          {" "}
          <feGaussianBlur result="blur2" stdDeviation="8" />{" "}
          <feComposite in="SourceGraphic" in2="blur2" operator="over" />{" "}
        </filter>{" "}
      </defs>{" "}
      <polygon
        fill="url(#floorGrad)"
        points="500,40 920,270 500,510 80,270"
        stroke="#494454"
        strokeOpacity="0.4"
        strokeWidth="1.2"
      />{" "}
      <polygon
        fill="#131315"
        points="80,270 500,510 500,528 80,288"
        stroke="#494454"
        strokeOpacity="0.3"
        strokeWidth="1"
      />{" "}
      <polygon
        fill="#0e0e10"
        points="500,510 920,270 920,288 500,528"
        stroke="#494454"
        strokeOpacity="0.3"
        strokeWidth="1"
      />{" "}
      <g stroke="#958ea0" strokeDasharray="2,4" strokeOpacity="0.15" strokeWidth="0.5">
        {" "}
        <line x1="290" x2="710" y1="155" y2="390" /> <line x1="185" x2="605" y1="212" y2="450" />{" "}
        <line x1="395" x2="815" y1="98" y2="330" /> <line x1="710" x2="290" y1="155" y2="390" />{" "}
        <line x1="605" x2="185" y1="98" y2="330" />{" "}
        <line x1="815" x2="395" y1="212" y2="450" />{" "}
      </g>{" "}
      <g transform="translate(500, 480)">
        {" "}
        <ellipse cx="0" cy="0" fill="#003824" fillOpacity="0.4" rx="36" ry="18" />{" "}
        <circle cx="-10" cy="-6" fill="#4edea3" filter="url(#glowSubtle)" r="4" />{" "}
        <circle cx="8" cy="-8" fill="#6ffbbe" opacity="0.8" r="6" />{" "}
        <circle cx="2" cy="-2" fill="#a078ff" filter="url(#glowSubtle)" r="3" />{" "}
        <path d="M-8,-4 Q-12,-18 -4,-22 Q0,-14 -6,-2" fill="#4edea3" opacity="0.7" />{" "}
        <path d="M6,-6 Q14,-24 4,-26 Q-2,-16 4,-4" fill="#00a572" opacity="0.6" />{" "}
      </g>{" "}
      <path
        d="M 500 230 Q 400 240 310 280"
        fill="none"
        id="pathMichaelNova"
        opacity="0.8"
        stroke="#d0bcff"
        strokeDasharray="4,6"
        strokeWidth="1.8"
      >
        {" "}
        <animate
          attributeName="stroke-dashoffset"
          dur="1.2s"
          from="20"
          repeatCount="indefinite"
          to="0"
        />{" "}
      </path>{" "}
      <path
        d="M 310 285 Q 460 380 660 370"
        fill="none"
        id="pathNovaScout"
        opacity="0.75"
        stroke="#4cd7f6"
        strokeDasharray="3,5"
        strokeWidth="1.5"
      >
        {" "}
        <animate
          attributeName="stroke-dashoffset"
          dur="1s"
          from="16"
          repeatCount="indefinite"
          to="0"
        />{" "}
      </path>{" "}
      <path
        d="M 515 220 Q 600 170 670 175"
        fill="none"
        id="pathMichaelPixel"
        opacity="0.6"
        stroke="#a078ff"
        strokeDasharray="2,5"
        strokeWidth="1.2"
      >
        {" "}
        <animate
          attributeName="stroke-dashoffset"
          dur="1.6s"
          from="14"
          repeatCount="indefinite"
          to="0"
        />{" "}
      </path>{" "}
      <g transform="translate(470, 315)">
        {" "}
        <rect
          fill="#1c1b1d"
          height="20"
          opacity="0.9"
          rx="4"
          stroke="#4cd7f6"
          strokeWidth="0.8"
          width="84"
          x="-42"
          y="-10"
        />{" "}
        <text
          fill="#4cd7f6"
          fontFamily="JetBrains Mono"
          fontSize="8.5"
          fontWeight="500"
          textAnchor="middle"
          x="0"
          y="3"
        >
          Not measured
        </text>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneOrchestration" {...zoneProps("michael")}>
        {" "}
        <polygon
          fill="url(#podiumGrad)"
          points="500,165 570,205 570,225 500,265 430,225 430,205"
          stroke="#a078ff"
          strokeOpacity="0.6"
          strokeWidth="1"
        />{" "}
        <polygon
          fill="#201f22"
          points="500,165 570,205 500,245 430,205"
          stroke="#d0bcff"
          strokeOpacity="0.8"
          strokeWidth="1.2"
        />{" "}
        <polygon fill="url(#violetGlow)" opacity="0.35" points="500,172 560,206 500,240 440,206" />{" "}
        <path
          d="M 455 210 Q 500 235 545 210"
          fill="none"
          filter="url(#glowSubtle)"
          stroke="#d0bcff"
          strokeLinecap="round"
          strokeWidth="4"
        />{" "}
        <path
          d="M 460 205 Q 500 228 540 205"
          fill="none"
          stroke="#201f22"
          strokeLinecap="round"
          strokeWidth="5"
        />{" "}
        <path
          d="M 452 195 Q 500 216 548 195"
          fill="none"
          opacity="0.25"
          stroke="#8b5cf6"
          strokeLinecap="round"
          strokeWidth="12"
        />{" "}
        <path
          d="M 455 194 Q 500 215 545 194"
          fill="none"
          stroke="#d0bcff"
          strokeDasharray="2,3"
          strokeWidth="1"
        />{" "}
        <circle cx="478" cy="190" fill="#6ffbbe" r="2.5" />{" "}
        <circle cx="500" cy="186" fill="#4cd7f6" r="3" />{" "}
        <circle cx="522" cy="190" fill="#d0bcff" r="2.5" />{" "}
        <line stroke="#4cd7f6" strokeWidth="0.8" x1="480" x2="497" y1="190" y2="186" />{" "}
        <line stroke="#d0bcff" strokeWidth="0.8" x1="503" x2="520" y1="186" y2="190" />{" "}
        <ellipse
          cx="500"
          cy="225"
          fill="#131315"
          rx="10"
          ry="6"
          stroke="#494454"
          strokeWidth="0.8"
        />{" "}
        <path d="M 494 218 L 506 218 L 508 206 L 492 206 Z" fill="#2a2a2c" />{" "}
        <circle cx="500" cy="199" fill="#353437" r="6.5" />{" "}
        <rect
          fill="#d0bcff"
          filter="url(#glowSubtle)"
          height="2.8"
          rx="1"
          width="10"
          x="495"
          y="198"
        />{" "}
        <circle
          cx="500"
          cy="199"
          fill="none"
          opacity="0.7"
          r="7"
          stroke="#d0bcff"
          strokeWidth="0.6"
        />{" "}
        <g transform="translate(500, 150)">
          {" "}
          <rect
            fill="#1c1b1d"
            filter="url(#glowSubtle)"
            height="22"
            rx="4"
            stroke="#a078ff"
            strokeWidth="1"
            width="130"
            x="-65"
            y="-12"
          />{" "}
          <circle cx="-52" cy="-1" fill="#a078ff" r="3">
            {" "}
            <animate
              attributeName="opacity"
              dur="1.8s"
              repeatCount="indefinite"
              values="0.3;1;0.3"
            />{" "}
          </circle>{" "}
          <text
            fill="#e9ddff"
            fontFamily="JetBrains Mono"
            fontSize="9"
            fontWeight="500"
            x="-42"
            y="3"
          >
            Michael: DAG Syncing
          </text>{" "}
          <circle cx="52" cy="-1" fill="#d0bcff" r="1.5" />{" "}
          <circle cx="56" cy="-1" fill="#4cd7f6" r="1.5" />{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneDevNova" {...zoneProps("nova")}>
        {" "}
        <polygon
          fill="#201f22"
          points="260,260 340,305 320,320 240,275"
          stroke="#4cd7f6"
          strokeWidth="1.2"
        />{" "}
        <polygon fill="#1c1b1d" points="262,263 336,304 318,317 244,276" />{" "}
        <rect
          fill="#0e0e10"
          height="32"
          rx="2"
          stroke="#4cd7f6"
          strokeWidth="1"
          transform="skewY(18)"
          width="22"
          x="290"
          y="245"
        />{" "}
        <rect
          fill="#0e0e10"
          height="30"
          rx="2"
          stroke="#494454"
          strokeWidth="0.8"
          transform="skewY(18)"
          width="20"
          x="268"
          y="235"
        />{" "}
        <line
          stroke="#4edea3"
          strokeLinecap="round"
          strokeWidth="1"
          x1="294"
          x2="308"
          y1="255"
          y2="260"
        />{" "}
        <line
          stroke="#4cd7f6"
          strokeLinecap="round"
          strokeWidth="1"
          x1="294"
          x2="305"
          y1="260"
          y2="264"
        />{" "}
        <line
          stroke="#d0bcff"
          strokeLinecap="round"
          strokeWidth="1"
          x1="294"
          x2="310"
          y1="265"
          y2="270"
        />{" "}
        <line
          stroke="#e5e1e4"
          strokeLinecap="round"
          strokeWidth="1"
          x1="294"
          x2="302"
          y1="270"
          y2="273"
        />{" "}
        <ellipse cx="265" cy="275" fill="#4cd7f6" filter="url(#glowSubtle)" rx="3.5" ry="2" />{" "}
        <rect fill="#03b5d3" height="4" width="5" x="262" y="271" />{" "}
        <ellipse cx="285" cy="305" fill="#131315" rx="9" ry="5.5" />{" "}
        <path d="M 280 298 L 292 298 L 294 286 L 278 286 Z" fill="#004e5c" />{" "}
        <circle cx="286" cy="281" fill="#353437" r="6" />{" "}
        <rect
          fill="#4cd7f6"
          filter="url(#glowSubtle)"
          height="2"
          rx="1"
          width="14"
          x="279"
          y="278"
        />{" "}
        <circle cx="279" cy="281" fill="#4cd7f6" r="2.5" />{" "}
        <circle cx="293" cy="281" fill="#4cd7f6" r="2.5" />{" "}
        <g transform="translate(260, 220)">
          {" "}
          <rect
            fill="#1c1b1d"
            filter="url(#glowSubtle)"
            height="20"
            rx="3"
            stroke="#4cd7f6"
            strokeWidth="1"
            width="112"
            x="-10"
            y="-11"
          />{" "}
          <circle cx="0" cy="-1" fill="#4cd7f6" r="2.5" />{" "}
          <text
            fill="#acedff"
            fontFamily="JetBrains Mono"
            fontSize="8.5"
            fontWeight="500"
            x="10"
            y="3"
          >
            Not measured
          </text>{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneDevAtlas" {...zoneProps("atlas")}>
        {" "}
        <polygon
          fill="#201f22"
          points="170,310 240,350 220,365 150,325"
          stroke="#494454"
          strokeWidth="0.8"
        />{" "}
        <polygon fill="#1c1b1d" points="172,312 238,349 218,362 153,326" />{" "}
        <rect
          fill="#0e0e10"
          height="22"
          rx="2"
          stroke="#03b5d3"
          strokeWidth="0.9"
          transform="skewY(16)"
          width="34"
          x="180"
          y="295"
        />{" "}
        <path
          d="M 183 310 Q 190 302 196 312 T 210 315"
          fill="none"
          opacity="0.8"
          stroke="#4cd7f6"
          strokeWidth="1"
        />{" "}
        <ellipse cx="198" cy="350" fill="#131315" rx="8" ry="5" />{" "}
        <path d="M 193 344 L 204 344 L 205 334 L 191 334 Z" fill="#2a2a2c" />{" "}
        <circle cx="198" cy="328" fill="#353437" r="5.5" />{" "}
        <rect fill="#00a572" height="2" width="8" x="194" y="327" />{" "}
        <g transform="translate(140, 280)">
          {" "}
          <rect
            fill="#1c1b1d"
            height="18"
            rx="3"
            stroke="#494454"
            strokeWidth="0.7"
            width="94"
            x="0"
            y="-9"
          />{" "}
          <circle cx="9" cy="0" fill="#4edea3" r="2" />{" "}
          <text fill="#e5e1e4" fontFamily="JetBrains Mono" fontSize="8" x="18" y="3.5">
            Atlas: Redis Bus
          </text>{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneDesignPixel" {...zoneProps("pixel")}>
        {" "}
        <polygon
          fill="#201f22"
          points="650,150 730,195 710,210 630,165"
          stroke="#ffb4ab"
          strokeWidth="0.8"
        />{" "}
        <polygon fill="#2a2a2c" points="652,152 728,194 708,207 633,166" />{" "}
        <polygon
          fill="#d0bcff"
          fillOpacity="0.25"
          points="665,160 705,183 695,192 655,169"
          stroke="#d0bcff"
          strokeWidth="0.8"
        />{" "}
        <circle cx="670" cy="168" fill="#8b5cf6" r="2.5" />{" "}
        <circle cx="678" cy="173" fill="#4cd7f6" r="2.5" />{" "}
        <circle cx="686" cy="178" fill="#4edea3" r="2.5" />{" "}
        <circle cx="694" cy="183" fill="#ffb4ab" r="2.5" />{" "}
        <ellipse cx="655" cy="195" fill="#131315" rx="8" ry="5" />{" "}
        <path d="M 650 188 L 661 188 L 662 178 L 649 178 Z" fill="#353437" />{" "}
        <circle cx="656" cy="172" fill="#201f22" r="5.5" />{" "}
        <rect fill="#d0bcff" height="2" width="7" x="653" y="171" />{" "}
        <g transform="translate(670, 130)">
          {" "}
          <rect
            fill="#1c1b1d"
            height="18"
            rx="3"
            stroke="#ffdad6"
            strokeWidth="0.8"
            width="105"
            x="-10"
            y="-9"
          />{" "}
          <circle cx="0" cy="0" fill="#ffb4ab" r="2.5" />{" "}
          <text fill="#ffb4ab" fontFamily="JetBrains Mono" fontSize="8" x="10" y="3.5">
            Pixel: Tokens PR #142
          </text>{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneQAScout" {...zoneProps("scout")}>
        {" "}
        <polygon
          fill="#201f22"
          points="650,330 730,375 705,395 625,350"
          stroke="#4edea3"
          strokeWidth="1"
        />{" "}
        <polygon fill="#1c1b1d" points="652,333 726,374 703,392 628,351" />{" "}
        <rect
          fill="#0e0e10"
          height="26"
          rx="1.5"
          stroke="#4edea3"
          strokeWidth="0.8"
          transform="skewY(-16)"
          width="18"
          x="670"
          y="325"
        />{" "}
        <rect
          fill="#0e0e10"
          height="26"
          rx="1.5"
          stroke="#4edea3"
          strokeWidth="0.8"
          transform="skewY(-16)"
          width="18"
          x="692"
          y="338"
        />{" "}
        <polyline fill="none" points="675,340 677,343 682,337" stroke="#4edea3" strokeWidth="1.2" />{" "}
        <polyline fill="none" points="675,348 677,351 682,345" stroke="#4edea3" strokeWidth="1.2" />{" "}
        <ellipse cx="648" cy="380" fill="#131315" rx="9" ry="5.5" />{" "}
        <path d="M 642 373 L 654 373 L 656 362 L 640 362 Z" fill="#003824" />{" "}
        <circle cx="648" cy="356" fill="#353437" r="6" />{" "}
        <circle cx="646" cy="356" fill="#6ffbbe" filter="url(#glowSubtle)" r="2.5" />{" "}
        <g transform="translate(640, 420)">
          {" "}
          <rect
            fill="#1c1b1d"
            height="20"
            rx="3"
            stroke="#4edea3"
            strokeWidth="0.9"
            width="118"
            x="-10"
            y="-10"
          />{" "}
          <text
            fill="#6ffbbe"
            fontFamily="JetBrains Mono"
            fontSize="8.5"
            textAnchor="middle"
            x="50"
            y="3"
          >
            Scout: not measured
          </text>{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zonePodEcho" {...zoneProps("echo")}>
        {" "}
        <ellipse
          cx="440"
          cy="115"
          fill="#16161a"
          fillOpacity="0.75"
          rx="55"
          ry="30"
          stroke="#958ea0"
          strokeDasharray="3,3"
          strokeWidth="1"
        />{" "}
        <path
          d="M 400 115 A 40 22 0 0 1 480 115"
          fill="none"
          opacity="0.4"
          stroke="#d0bcff"
          strokeWidth="1"
        />{" "}
        <rect
          fill="#d0bcff"
          fillOpacity="0.1"
          height="30"
          rx="2"
          stroke="#a078ff"
          strokeWidth="0.8"
          width="24"
          x="428"
          y="90"
        />{" "}
        <line stroke="#cbc3d7" strokeWidth="0.8" x1="432" x2="448" y1="96" y2="96" />{" "}
        <line stroke="#cbc3d7" strokeWidth="0.8" x1="432" x2="446" y1="102" y2="102" />{" "}
        <line stroke="#cbc3d7" strokeWidth="0.8" x1="432" x2="444" y1="108" y2="108" />{" "}
        <ellipse cx="440" cy="120" fill="#131315" rx="8" ry="4.5" />{" "}
        <circle cx="440" cy="107" fill="#2a2a2c" r="5.5" />{" "}
        <rect fill="#d0bcff" height="1.8" opacity="0.8" width="6" x="437" y="106" />{" "}
        <g transform="translate(440, 70)">
          {" "}
          <rect
            fill="#1c1b1d"
            height="18"
            rx="3"
            stroke="#494454"
            strokeWidth="0.7"
            width="96"
            x="-48"
            y="-9"
          />{" "}
          <text
            fill="#cbc3d7"
            fontFamily="JetBrains Mono"
            fontSize="8"
            textAnchor="middle"
            x="0"
            y="3.5"
          >
            Echo: RFC Vault
          </text>{" "}
        </g>{" "}
      </g>{" "}
      <g className="cursor-pointer group" id="zoneLounge">
        {" "}
        <path
          d="M 760 250 L 820 285 L 800 300 L 740 265 Z"
          fill="#201f22"
          stroke="#494454"
          strokeWidth="0.8"
        />{" "}
        <path
          d="M 760 250 L 820 285"
          filter="url(#glowSubtle)"
          opacity="0.6"
          stroke="#a078ff"
          strokeWidth="2"
        />{" "}
        <polygon fill="#2a2a2c" points="740,265 765,280 755,290 730,275" />{" "}
        <polygon
          fill="#1c1b1d"
          points="840,240 860,252 860,285 840,273"
          stroke="#4cd7f6"
          strokeWidth="0.9"
        />{" "}
        <rect
          fill="#03b5d3"
          filter="url(#glowSubtle)"
          height="12"
          opacity="0.75"
          transform="skewY(18)"
          width="10"
          x="844"
          y="248"
        />{" "}
        <polygon fill="#353437" points="785,225 805,236 805,250 785,239" />{" "}
        <circle cx="795" cy="235" fill="#ffb4ab" r="1.5" />{" "}
        <g transform="translate(790, 320)">
          {" "}
          <rect
            fill="#1c1b1d"
            height="17"
            rx="3"
            stroke="#494454"
            strokeWidth="0.7"
            width="90"
            x="-45"
            y="-8"
          />{" "}
          <text
            fill="#958ea0"
            fontFamily="JetBrains Mono"
            fontSize="7.5"
            textAnchor="middle"
            x="0"
            y="4"
          >
            {"Lounge & Espresso"}
          </text>{" "}
        </g>{" "}
      </g>{" "}
    </svg>
  );
}
