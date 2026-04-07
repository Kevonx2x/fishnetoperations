import Image from "next/image";
import Link from "next/link";

type Props = {
  /** When true, use Next/Image priority (e.g. above-the-fold nav). */
  priority?: boolean;
  className?: string;
  /** Display width in px (height follows 140×50 aspect). */
  width?: number;
};

/** BahayGo wordmark — `public/bahaygologo.png` (replace with final asset as needed). */
export function BahayGoLogoLink({ priority = false, className, width = 120 }: Props) {
  const h = Math.round((width * 50) / 140);
  return (
    <Link href="/" className={className ?? "inline-block leading-none"}>
      <Image
        src="/bahaygologo.png"
        alt="BahayGo"
        width={width}
        height={h}
        className="h-auto max-w-none object-contain"
        style={{ width }}
        priority={priority}
        sizes={`${width}px`}
      />
    </Link>
  );
}
