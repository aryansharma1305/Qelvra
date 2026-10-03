// SVG bodies of the four avatar options in the Stitch wizard design.
export const AVATAR_COUNT = 4;

export function AvatarGlyph({ index }: { index: number }) {
  switch (index) {
    case 1:
      return (
        <>
          <circle cx="12" cy="12" r="9" /> <circle cx="12" cy="12" r="5" />{" "}
          <line x1="12" x2="12" y1="3" y2="7" /> <line x1="12" x2="12" y1="17" y2="21" />
        </>
      );
    case 2:
      return (
        <>
          <path d="M12 2L2 19h20L12 2z" /> <circle cx="12" cy="13" r="2.5" />
        </>
      );
    case 3:
      return <polygon points="12 2 19 8.5 19 15.5 12 22 5 15.5 5 8.5 12 2" />;
    default:
      return (
        <>
          <polygon points="12 2 2 7 12 12 22 7 12 2" strokeLinecap="round" strokeLinejoin="round" />{" "}
          <polyline points="2 17 12 22 22 17" strokeLinecap="round" strokeLinejoin="round" />{" "}
          <polyline points="2 12 12 17 22 12" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
  }
}
