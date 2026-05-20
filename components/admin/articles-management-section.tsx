"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ARTICLE_CATEGORIES,
  slugifyArticleTitle,
  type Article,
} from "@/lib/articles";
import { cn } from "@/lib/utils";
import { ArticleCoverImageField } from "@/components/admin/article-cover-image-field";

/** Explicit colors so fields stay readable when admin runs under dark `text-foreground`. */
const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm text-[#2C2C2C] placeholder:text-[#2C2C2C]/40 shadow-none";

const emptyForm = () => ({
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  category: ARTICLE_CATEGORIES[0] as string,
  cover_image_url: "",
  read_minutes: "5",
  published: false,
  homepage_featured: false,
  homepage_order: "0",
});

export function ArticlesManagementSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/articles", { credentials: "include" });
      const json = (await res.json()) as { articles?: Article[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to load articles");
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: Article) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      body: row.body,
      category: row.category,
      cover_image_url: row.cover_image_url,
      read_minutes: String(row.read_minutes),
      published: row.published,
      homepage_featured: row.homepage_featured,
      homepage_order: String(row.homepage_order),
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugifyArticleTitle(form.title),
      excerpt: form.excerpt.trim(),
      body: form.body.trim(),
      category: form.category,
      cover_image_url: form.cover_image_url.trim(),
      read_minutes: Number(form.read_minutes) || 5,
      published: form.published,
      homepage_featured: form.homepage_featured,
      homepage_order: Number(form.homepage_order) || 0,
    };
    try {
      const res = await fetch(
        editingId ? `/api/admin/articles/${editingId}` : "/api/admin/articles",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success(editingId ? "Article updated" : "Article created");
      setModalOpen(false);
      void load();
    } catch {
      toast.error("Could not reach server");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Delete failed");
        return;
      }
      toast.success("Article deleted");
      void load();
    } catch {
      toast.error("Could not reach server");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Articles &amp; Guides</h2>
          <p className="mt-1 text-sm text-[#2C2C2C]/60">
            Publish short reads on /blog. Flag up to three for the homepage (order 0–2).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6B9E6E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a8d5d]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New article
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-[#2C2C2C]/55">Loading articles…</p>
        ) : articles.length === 0 ? (
          <p className="p-6 text-sm text-[#2C2C2C]/55">No articles yet. Create your first one.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/80 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Homepage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-[#2C2C2C]/6 last:border-0 hover:bg-[#FAF8F4]/80"
                  onClick={() => openEdit(row)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#2C2C2C]">{row.title}</p>
                    <p className="text-xs text-[#2C2C2C]/45">/blog/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[#2C2C2C]/65">{row.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.published
                          ? "rounded-full bg-[#6B9E6E]/15 px-2 py-0.5 text-xs font-bold text-[#4A7A4D]"
                          : "rounded-full bg-[#2C2C2C]/8 px-2 py-0.5 text-xs font-bold text-[#2C2C2C]/55"
                      }
                    >
                      {row.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#2C2C2C]/65">
                    {row.homepage_featured ? `Yes (#${row.homepage_order})` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-lg border border-[#2C2C2C]/10 p-2 text-[#2C2C2C] hover:bg-[#FAF8F4]"
                        aria-label={`Edit ${row.title}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => void remove(row.id, row.title)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Delete ${row.title}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
          <div className="w-full max-w-2xl rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-[#2C2C2C] shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">
                {editingId ? "Edit article" : "New article"}
              </h3>
              {editingId && form.slug ? (
                <a
                  href={`/blog/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#6B9E6E] hover:underline"
                >
                  Preview on site ↗
                </a>
              ) : null}
            </div>
            {editingId ? (
              <p className="mt-1 text-xs text-[#2C2C2C]/55">
                Saving updates this article in place — not a new post.
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  className={FIELD}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Slug (URL)</span>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                  placeholder={slugifyArticleTitle(form.title) || "auto-from-title"}
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  className={FIELD}
                >
                  {ARTICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Read time (minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.read_minutes}
                  onChange={(e) => setForm((s) => ({ ...s, read_minutes: e.target.value }))}
                  className={FIELD}
                />
              </label>
              <ArticleCoverImageField
                value={form.cover_image_url}
                onChange={(url) => setForm((s) => ({ ...s, cover_image_url: url }))}
                disabled={saving}
                inputClassName={FIELD}
              />
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Excerpt (card summary)</span>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((s) => ({ ...s, excerpt: e.target.value }))}
                  rows={2}
                  className={cn(FIELD, "resize-y")}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-[#2C2C2C]/55">
                  Body (paragraphs separated by blank lines; **bold** supported)
                </span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
                  rows={12}
                  className={cn(FIELD, "resize-y font-mono leading-relaxed")}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((s) => ({ ...s, published: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
                />
                <span className="text-sm font-semibold text-[#2C2C2C]">Published</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.homepage_featured}
                  onChange={(e) => setForm((s) => ({ ...s, homepage_featured: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
                />
                <span className="text-sm font-semibold text-[#2C2C2C]">Homepage featured</span>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#2C2C2C]/55">Homepage order (0 = first)</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={form.homepage_order}
                  onChange={(e) => setForm((s) => ({ ...s, homepage_order: e.target.value }))}
                  className={FIELD}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-[#2C2C2C]/10 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-xl bg-[#6B9E6E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create article"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
