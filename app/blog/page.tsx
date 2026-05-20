"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { ArticleCard } from "@/components/articles/article-card";
import type { Article } from "@/lib/articles";

export default function BlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/articles");
        const json = (await res.json()) as { articles?: Article[]; error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not load articles");
          setArticles([]);
        } else {
          setArticles(json.articles ?? []);
        }
      } catch {
        setError("Could not reach server");
        setArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
          Articles &amp; Guides
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
          BahayGo Articles &amp; Guides
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium text-[#2C2C2C]/65">
          Short reads on neighborhoods, market trends, and life in the Philippines — written for
          buyers and renters using verified agents.
        </p>

        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[400px] animate-pulse rounded-2xl bg-[#2C2C2C]/8" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-10 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            {error.includes("articles") || error.includes("relation") ? (
              <span className="mt-1 block text-red-700/80">
                Run the articles migration in Supabase if you have not yet.
              </span>
            ) : null}
          </p>
        ) : articles.length === 0 ? (
          <p className="mt-10 text-sm font-semibold text-[#2C2C2C]/55">
            No published articles yet. Add one from Admin → Articles.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        <Link
          href="/"
          className="mt-12 inline-flex rounded-full border-2 border-[#6B9E6E] bg-white px-6 py-2.5 text-sm font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
