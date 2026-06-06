/** Subtle Philippine flag — centered, large, low opacity wallpaper. */
export function PhilippineFlagWatermark() {
  return (
    <div
      className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <svg
        viewBox="0 0 960 480"
        className="h-[min(52vh,460px)] w-[min(88vw,760px)] opacity-[0.055] mix-blend-multiply"
        role="img"
        aria-hidden
      >
        <rect width="960" height="240" y="0" fill="#0038A8" />
        <rect width="960" height="240" y="240" fill="#CE1126" />
        <polygon points="0,0 0,480 480,240" fill="#FFFFFF" />
        <circle cx="168" cy="240" r="52" fill="#FCD116" opacity="0.92" />
        <g fill="#FCD116" opacity="0.88">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <polygon
              key={deg}
              points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3"
              transform={`translate(168 240) rotate(${deg}) translate(0,-78)`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
