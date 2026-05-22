"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ArticleCard } from "@/components/articles/article-card";
import type { Article } from "@/lib/articles";
import { cn } from "@/lib/utils";

type HomepageArticlesSectionProps = {
  className?: string;
};

export function HomepageArticlesSection({ className }: HomepageArticlesSectionProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/articles?featured=homepage&limit=3");
        const json = (await res.json()) as { articles?: Article[] };
        if (!cancelled) {
          setArticles(json.articles ?? []);
        }
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && articles.length === 0) {
    return <div className={cn("min-h-[1px]", className)} aria-hidden />;
  }

  return (
    <section
      className={cn("mx-auto max-w-6xl px-4 pb-16", className)}
      aria-labelledby="homepage-articles-heading"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="homepage-articles-heading"
            className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] md:text-3xl"
          >
            BahayGo Articles &amp; Guides
          </h2>
          <p className="mt-2 text-sm font-medium text-[#2C2C2C]/70">
            Weekly insights to help you make smarter real estate decisions.
          </p>
        </div>
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          View all articles
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-2xl bg-[#2C2C2C]/8" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}
