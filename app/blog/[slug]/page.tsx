"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { ArticleBody } from "@/components/articles/article-body";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import type { Article } from "@/lib/articles";

export default function BlogArticlePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) {
            setArticle(null);
            setNotFound(true);
          }
          return;
        }
        const json = (await res.json()) as { article?: Article };
        if (!cancelled) {
          setArticle(json.article ?? null);
          setNotFound(!json.article);
        }
      } catch {
        if (!cancelled) {
          setArticle(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const publishedLabel = article?.published_at
    ? new Date(article.published_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16">
      <MaddenTopNav />
      <main className="mx-auto max-w-3xl px-4 pt-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All articles
        </Link>

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-[#2C2C2C]/10" />
            <div className="aspect-video animate-pulse rounded-2xl bg-[#2C2C2C]/10" />
            <div className="h-4 w-full animate-pulse rounded bg-[#2C2C2C]/10" />
            <div className="h-4 w-full animate-pulse rounded bg-[#2C2C2C]/10" />
          </div>
        ) : notFound || !article ? (
          <div className="mt-10 rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center">
            <p className="font-serif text-xl font-bold text-[#2C2C2C]">Article not found</p>
            <p className="mt-2 text-sm text-[#2C2C2C]/60">It may be unpublished or removed.</p>
            <Link
              href="/blog"
              className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white"
            >
              Browse articles
            </Link>
          </div>
        ) : (
          <article className="mt-6">
            <span className="inline-flex rounded-full bg-[#6B9E6E]/12 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#4A7A4D]">
              {article.category}
            </span>
            <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#2C2C2C] md:text-4xl">
              {article.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-[#2C2C2C]/50">
              {publishedLabel ? <span>{publishedLabel}</span> : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {article.read_minutes} min read
              </span>
            </div>
            {article.cover_image_url ? (
              <div className="relative mt-6 aspect-video overflow-hidden rounded-2xl bg-[#F3F0EA] shadow-[0_4px_20px_rgba(44,44,44,0.1)]">
                <Image
                  src={article.cover_image_url}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <p className="mt-8 text-lg font-medium leading-relaxed text-[#2C2C2C]/75">
              {article.excerpt}
            </p>
            <ArticleBody body={article.body} className="mt-6" />
          </article>
        )}
      </main>
    </div>
  );
}
