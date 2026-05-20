export const ARTICLE_CATEGORIES = [
  "LOCATION GUIDE",
  "LOCAL FINDS",
  "TRAVEL GUIDE",
  "MARKET INSIGHTS",
  "BUYING TIPS",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  cover_image_url: string;
  read_minutes: number;
  published: boolean;
  published_at: string | null;
  homepage_featured: boolean;
  homepage_order: number;
  created_at: string;
  updated_at: string;
};

export function slugifyArticleTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function isArticleCategory(value: string): value is ArticleCategory {
  return (ARTICLE_CATEGORIES as readonly string[]).includes(value);
}

export function formatArticleCategoryLabel(category: string): string {
  return category.trim().toUpperCase();
}
