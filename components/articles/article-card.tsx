import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Article } from "@/lib/articles";
import { cn } from "@/lib/utils";

type ArticleCardProps = {
  article: Pick<
    Article,
    "slug" | "title" | "excerpt" | "category" | "cover_image_url" | "read_minutes"
  >;
  className?: string;
};

export function ArticleCard({ article, className }: ArticleCardProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(44,44,44,0.08)] transition hover:shadow-[0_8px_24px_rgba(44,44,44,0.12)]",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F3F0EA]">
        {article.cover_image_url ? (
          <Image
            src={article.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-[#2C2C2C]/40">
            BahayGo
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="mb-2 inline-flex w-fit rounded-full bg-[#6B9E6E]/12 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#4A7A4D]">
          {article.category}
        </span>
        <h3 className="font-serif text-lg font-bold leading-snug text-[#2C2C2C]">{article.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-[#2C2C2C]/65">{article.excerpt}</p>
        <p className="mt-2 text-xs font-medium text-[#2C2C2C]/45">{article.read_minutes} min read</p>
        <Link
          href={`/blog/${article.slug}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Read More
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
