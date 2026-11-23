import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

const RATIO = 600 / 577; // width / height of public/logo-mark.png

/** The official logo (public/logo.png, kept untouched), with its empty margin trimmed and plain background made transparent
 *  (public/logo-mark.png) so it sits cleanly on white or ivory. */
export default function Logo({ className = "h-11 w-auto lg:h-14" }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${BRAND} home`} className="inline-flex items-center">
      <Image src="/logo-mark.png" alt={BRAND} width={Math.round(56 * RATIO)} height={56} priority className={className} />
    </Link>
  );
}
