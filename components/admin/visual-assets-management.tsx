"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { VisualAssetImageField } from "@/components/admin/visual-asset-image-field";
import {
  slugifyVisualAssetName,
  type BahaygoFeaturedLocationRow,
  type DormspaceFeaturedNeighborhoodRow,
  type UniversityVisualAssetRow,
} from "@/lib/visual-assets";
import { universityInitials } from "@/lib/universities";
import { cn } from "@/lib/utils";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm text-[#2C2C2C] placeholder:text-[#2C2C2C]/40";

type TabId = "universities" | "dormspace-neighborhoods" | "bahaygo-locations";

const TABS: { id: TabId; label: string }[] = [
  { id: "universities", label: "Universities" },
  { id: "dormspace-neighborhoods", label: "Dormspaces neighborhoods" },
  { id: "bahaygo-locations", label: "BahayGo locations" },
];

export function VisualAssetsManagement() {
  const [tab, setTab] = useState<TabId>("universities");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Visual assets</h1>
        <p className="mt-2 text-sm font-medium text-[#484848]">
          Manage homepage images for universities, dormspace neighborhoods, and BahayGo featured locations.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition",
              tab === item.id
                ? "bg-[#6B9E6E] text-white shadow-sm"
                : "bg-white text-[#484848] ring-1 ring-[#2C2C2C]/10 hover:bg-[#FAF8F4]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "universities" ? <UniversitiesTab /> : null}
      {tab === "dormspace-neighborhoods" ? <DormspaceNeighborhoodsTab /> : null}
      {tab === "bahaygo-locations" ? <BahaygoLocationsTab /> : null}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[#484848] hover:bg-[#FAF8F4]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UniversitiesTab() {
  const [rows, setRows] = useState<UniversityVisualAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UniversityVisualAssetRow | null>(null);
  const [form, setForm] = useState({ image_url: "", display_order: "100", is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visual-assets/universities", { credentials: "include" });
      const json = (await res.json()) as { universities?: UniversityVisualAssetRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load universities");
      setRows(json.universities ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load universities");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (row: UniversityVisualAssetRow) => {
    setEditing(row);
    setForm({
      image_url: row.image_url ?? "",
      display_order: String(row.display_order),
      is_active: row.is_active,
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/visual-assets/universities/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: form.image_url,
          display_order: Number(form.display_order),
          is_active: form.is_active,
        }),
      });
      const json = (await res.json()) as { university?: UniversityVisualAssetRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success("University updated");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-[#484848]">Loading universities…</p>;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FAF8F4] text-xs font-bold uppercase tracking-wide text-[#484848]">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#2C2C2C]/8">
                <td className="px-4 py-3">
                  <div className="relative size-12 overflow-hidden rounded-full bg-[#E8F0E9] ring-1 ring-[#6B9E6E]/20">
                    {row.image_url ? (
                      <Image src={row.image_url} alt="" fill className="object-cover" sizes="48px" unoptimized />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs font-bold text-[#6B9E6E]">
                        {universityInitials(row.short_name)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#2C2C2C]">
                  {row.name}
                  <span className="block text-xs font-medium text-[#888888]">{row.short_name}</span>
                </td>
                <td className="px-4 py-3">{row.display_order}</td>
                <td className="px-4 py-3">{row.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ModalShell title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <VisualAssetImageField
            variant="university"
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            disabled={saving}
          />
          <label className="mt-4 block text-xs font-bold text-[#2C2C2C]/55">
            Display order
            <input
              type="number"
              className={FIELD}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#2C2C2C]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="mt-5 w-full rounded-xl bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </ModalShell>
      ) : null}
    </>
  );
}

type NeighborhoodForm = {
  name: string;
  slug: string;
  city: string;
  image_url: string;
  display_order: string;
  is_active: boolean;
};

const emptyNeighborhoodForm = (): NeighborhoodForm => ({
  name: "",
  slug: "",
  city: "",
  image_url: "",
  display_order: "100",
  is_active: true,
});

function DormspaceNeighborhoodsTab() {
  return <CrudNeighborhoodsTab kind="dormspace" />;
}

function BahaygoLocationsTab() {
  return <CrudNeighborhoodsTab kind="bahaygo" />;
}

function CrudNeighborhoodsTab({ kind }: { kind: "dormspace" | "bahaygo" }) {
  const baseUrl =
    kind === "dormspace"
      ? "/api/admin/visual-assets/dormspace-neighborhoods"
      : "/api/admin/visual-assets/bahaygo-locations";
  const listKey = kind === "dormspace" ? "neighborhoods" : "locations";

  const [rows, setRows] = useState<(DormspaceFeaturedNeighborhoodRow | BahaygoFeaturedLocationRow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NeighborhoodForm>(emptyNeighborhoodForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { credentials: "include" });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(json.error ?? "Failed to load"));
      setRows((json[listKey] as typeof rows) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, listKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyNeighborhoodForm());
    setModalOpen(true);
  };

  const openEdit = (row: DormspaceFeaturedNeighborhoodRow | BahaygoFeaturedLocationRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      slug: row.slug,
      city: row.city ?? "",
      image_url: row.image_url ?? "",
      display_order: String(row.display_order),
      is_active: row.is_active,
    });
    setModalOpen(true);
  };

  const autoSlug = useMemo(
    () => (form.slug.trim() ? form.slug : slugifyVisualAssetName(form.name)),
    [form.name, form.slug],
  );

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: autoSlug,
        city: form.city.trim() || null,
        image_url: form.image_url.trim() || null,
        display_order: Number(form.display_order),
        is_active: form.is_active,
      };
      const res = await fetch(editingId ? `${baseUrl}/${editingId}` : baseUrl, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(json.error ?? "Save failed"));
      toast.success(editingId ? "Saved" : "Created");
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this item?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${baseUrl}/${id}`, { method: "DELETE", credentials: "include" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <p className="text-sm text-[#484848]">Loading…</p>;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-xl bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60]"
        >
          <Plus className="size-4" aria-hidden />
          Add new
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FAF8F4] text-xs font-bold uppercase tracking-wide text-[#484848]">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#2C2C2C]/8">
                <td className="px-4 py-3">
                  <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-[#F3F0EA]">
                    {row.image_url ? (
                      <Image src={row.image_url} alt="" fill className="object-cover" sizes="64px" unoptimized />
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#2C2C2C]">{row.name}</td>
                <td className="px-4 py-3 text-[#888888]">{row.slug}</td>
                <td className="px-4 py-3">{row.display_order}</td>
                <td className="px-4 py-3">{row.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => void remove(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <ModalShell
          title={editingId ? "Edit item" : "Add item"}
          onClose={() => setModalOpen(false)}
        >
          <label className="block text-xs font-bold text-[#2C2C2C]/55">
            Name
            <input
              className={FIELD}
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugifyVisualAssetName(e.target.value),
                }))
              }
            />
          </label>
          <label className="mt-3 block text-xs font-bold text-[#2C2C2C]/55">
            Slug
            <input className={FIELD} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className="mt-3 block text-xs font-bold text-[#2C2C2C]/55">
            City (optional)
            <input className={FIELD} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </label>
          <div className="mt-4">
            <VisualAssetImageField
              variant="landscape"
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              disabled={saving}
            />
          </div>
          <label className="mt-3 block text-xs font-bold text-[#2C2C2C]/55">
            Display order
            <input
              type="number"
              className={FIELD}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#2C2C2C]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="mt-5 w-full rounded-xl bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </ModalShell>
      ) : null}
    </>
  );
}
