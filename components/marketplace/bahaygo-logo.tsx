import Image from "next/image";
import Link from "next/link";

type Props = {
  /** When true, use Next/Image priority (e.g. above-the-fold nav). */
  priority?: boolean;
  className?: string;
};

/** BahayGo wordmark — `public/bahaygologo.png` (replace with final asset as needed). */
export function BahayGoLogoLink({ priority = false, className }: Props) {
  return (
    <Link href="/" className={className ?? "inline-block leading-none"}>
      <Image
        src="/bahaygologo.png"
        alt="BahayGo"
        width={120}
        height={40}
        className="h-auto w-[120px] max-w-[120px]"
        priority={priority}
        sizes="120px"
      />
    </Link>
  );
}
