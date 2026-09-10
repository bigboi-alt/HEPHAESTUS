import marbleLight from "../assets/logo-512.png";
import marbleInk from "../assets/logo-ink-512.png";

/**
 * The Hephaestus emblem, on transparency — no black field.
 *
 * The mark is a light marble relief, so it vanishes on the light themes. Two cuts ship
 * (marble + brown ink) and CSS picks one from [data-theme]; nothing here needs to know
 * about settings. Small renders get the 512 cut downscaled by the browser, which keeps
 * the pixel texture crisp enough at 28px.
 */
export default function Emblem({
  size = 54,
  radius = 0,
  alt = "Hephaestus",
  style,
}: {
  size?: number;
  radius?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="emblem"
      style={{ width: size, height: size, borderRadius: radius || undefined, flexShrink: 0, ...style }}
    >
      <img className="emblem-marble" src={marbleLight} alt={alt} width={size} height={size} draggable={false} />
      <img className="emblem-ink" src={marbleInk} alt="" aria-hidden="true" width={size} height={size} draggable={false} />
    </span>
  );
}
