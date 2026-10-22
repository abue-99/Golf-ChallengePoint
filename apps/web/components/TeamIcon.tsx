/** Renders a team icon – either a coloured circle SVG ("circle:#hex") or an emoji string. */
export default function TeamIcon({
  icon,
  size = 22,
  className = "",
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  if (icon.startsWith("circle:")) {
    const color = icon.slice(7);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 22 22"
        className={className}
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="10" fill={color} />
      </svg>
    );
  }
  return (
    <span
      className={`leading-none ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
