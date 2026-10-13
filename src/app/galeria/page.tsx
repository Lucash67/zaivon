"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  GripVertical,
  Images,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ModuleShell } from "@/components/layout/module-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { PageLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { useGaleria } from "@/hooks/use-galeria";
import {
  GALLERY_CATEGORIES,
  GALLERY_CATEGORY_LABELS,
  type GalleryAsset,
  type GalleryCategory,
  type GalleryFileMeta,
} from "@/lib/galeria/types";
import { cn } from "@/lib/utils";

export default function GaleriaPage() {
  const {
    items,
    loading,
    error,
    canWrite,
    writeBlockedMessage,
    createItem,
    addFiles,
    reorderItems,
    deleteFile,
    removeItem,
  } = useGaleria();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GalleryCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GalleryCategory>("arte");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const q = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (!q) return true;
    const inFiles = item.files.some((f) => f.fileName.toLowerCase().includes(q));
    return (
      item.title.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q) ||
      (item.fileName ?? "").toLowerCase().includes(q) ||
      inFiles ||
      GALLERY_CATEGORY_LABELS[item.category].toLowerCase().includes(q)
    );
  });

  const previewAsset = previewAssetId
    ? (items.find((i) => i.id === previewAssetId) ?? null)
    : null;
  const previewFile =
    previewAsset && previewFileId
      ? (previewAsset.files.find((f) => f.id === previewFileId) ??
        previewAsset.files[0] ??
        null)
      : previewAsset?.files[0] ?? null;

  useEffect(() => {
    if (!previewAssetId) return;
    const asset = items.find((i) => i.id === previewAssetId);
    if (!asset) {
      setPreviewAssetId(null);
      setPreviewFileId(null);
      return;
    }
    if (asset.files.length === 0) {
      setPreviewAssetId(null);
      setPreviewFileId(null);
      return;
    }
    if (!previewFileId || !asset.files.some((f) => f.id === previewFileId)) {
      setPreviewFileId(asset.files[0]!.id);
    }
  }, [items, previewAssetId, previewFileId]);

  useEffect(() => {
    if (!previewAssetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewAssetId(null);
        setPreviewFileId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [previewAssetId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError(null);
    try {
      await createItem({ title, category, notes, files });
      setTitle("");
      setNotes("");
      setFiles([]);
      setCategory("arte");
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function requestAttach(id: string) {
    setAttachTargetId(id);
    attachInputRef.current?.click();
  }

  async function onAttachChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    const id = attachTargetId;
    e.target.value = "";
    setAttachTargetId(null);
    if (picked.length === 0 || !id || !canWrite) return;
    setSaving(true);
    try {
      await addFiles(id, picked);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao anexar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GalleryAsset) {
    if (!canWrite) return;
    if (!confirm(`Excluir a pasta “${item.title}”?`)) return;
    try {
      await removeItem(item.id);
      if (previewAssetId === item.id) {
        setPreviewAssetId(null);
        setPreviewFileId(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  function openPreview(item: GalleryAsset, fileId?: string) {
    if (!item.hasFile || item.files.length === 0) return;
    const first = fileId
      ? item.files.find((f) => f.id === fileId)
      : item.files[0];
    if (!first) return;
    const mime = first.mimeType;
    if (first.isImage || mime === "application/pdf") {
      setPreviewAssetId(item.id);
      setPreviewFileId(first.id);
      return;
    }
    window.open(first.previewUrl || first.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!canWrite) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    try {
      await reorderItems(arrayMove(ids, from, to));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao reordenar");
    }
  }

  async function handleDeleteFile(assetId: string, fileId: string) {
    if (!canWrite) return;
    if (!confirm("Excluir este arquivo da pasta?")) return;
    try {
      await deleteFile(assetId, fileId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir arquivo");
    }
  }

  if (loading) {
    return (
      <ModuleShell title="Galeria" subtitle="Design, arte e materiais da operação">
        <PageLoader />
      </ModuleShell>
    );
  }

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((item) =>
        canWrite ? (
          <SortableAssetCard
            key={item.id}
            item={item}
            canWrite={canWrite}
            onPreview={() => openPreview(item)}
            onAttach={() => requestAttach(item.id)}
            onDelete={() => handleDelete(item)}
          />
        ) : (
          <AssetCard
            key={item.id}
            item={item}
            canWrite={false}
            onPreview={() => openPreview(item)}
            onAttach={() => undefined}
            onDelete={() => undefined}
          />
        ),
      )}
    </div>
  );

  return (
    <ModuleShell
      title="Galeria"
      subtitle="Design, arte e materiais da operação"
      actions={
        canWrite ? (
          <Button type="button" onClick={() => setShowForm((v) => !v)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova pasta
          </Button>
        ) : undefined
      }
    >
      {!canWrite && <BusinessWriteNotice message={writeBlockedMessage} />}

      <input
        ref={attachInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.pdf,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
        onChange={onAttachChange}
      />

      <div className="mb-4 space-y-3">
        <p className="max-w-2xl text-sm text-text-secondary">
          Pastas com cardápios, cartazes, anúncios e referências. Clique para abrir a pasta;
          {canWrite ? " arraste os cards para reordenar." : ""}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, nota ou arquivo…"
              className="w-full rounded-xl border border-surface-border bg-surface-card py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-z-primary/50"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GalleryCategory | "all")}
            className="rounded-xl border border-surface-border bg-surface-card px-3 py-2.5 text-sm text-text-primary"
          >
            <option value="all">Todas as categorias</option>
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {GALLERY_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && canWrite && (
        <form
          onSubmit={handleCreate}
          className="mb-5 rounded-2xl border border-z-primary/25 bg-surface-card p-4 sm:p-5"
        >
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Nova pasta</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-text-muted">Título</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm"
                placeholder="Ex.: Cardápio setembro"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-text-muted">Categoria</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GalleryCategory)}
                className="w-full rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm"
              >
                {GALLERY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {GALLERY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-text-muted">
                Arquivos (opcional, até 4 MB cada — enviados um a um)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                className="w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-z-primary/20 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-z-lime-300"
              />
              {files.length > 0 ? (
                <span className="text-[11px] text-text-muted">
                  {files.length} arquivo{files.length === 1 ? "" : "s"} selecionado
                  {files.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-text-muted">Notas</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm"
                placeholder="Contexto, onde foi usado, versão…"
              />
            </label>
          </div>
          {formError && <p className="mt-2 text-sm text-brand-red">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving} className="gap-2">
              <Upload className="h-4 w-4" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface-card/50 px-4 py-12 text-center">
          <Images className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-secondary">Nenhuma pasta neste filtro.</p>
        </div>
      ) : canWrite ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((i) => i.id)} strategy={rectSortingStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      ) : (
        grid
      )}

      {previewAsset && previewFile ? (
        <GalleryLightbox
          item={previewAsset}
          file={previewFile}
          canWrite={canWrite}
          onClose={() => {
            setPreviewAssetId(null);
            setPreviewFileId(null);
          }}
          onSelectFile={(id) => setPreviewFileId(id)}
          onDeleteFile={(fileId) => handleDeleteFile(previewAsset.id, fileId)}
        />
      ) : null}
    </ModuleShell>
  );
}

function GalleryLightbox({
  item,
  file,
  canWrite,
  onClose,
  onSelectFile,
  onDeleteFile,
}: {
  item: GalleryAsset;
  file: GalleryFileMeta;
  canWrite: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
}) {
  const imageFiles = item.files.filter((f) => f.isImage);
  const showImageNav = file.isImage && imageFiles.length > 1;
  const imageIndex = imageFiles.findIndex((f) => f.id === file.id);

  function goPrev() {
    if (!showImageNav || imageIndex < 0) return;
    const prev = imageFiles[(imageIndex - 1 + imageFiles.length) % imageFiles.length]!;
    onSelectFile(prev.id);
  }

  function goNext() {
    if (!showImageNav || imageIndex < 0) return;
    const next = imageFiles[(imageIndex + 1) % imageFiles.length]!;
    onSelectFile(next.id);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav depends on current file
  }, [file.id, showImageNav, imageIndex, imageFiles.length]);

  const isPdf = file.mimeType === "application/pdf";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.title}</p>
            <p className="truncate text-xs text-white/55">
              {GALLERY_CATEGORY_LABELS[item.category]}
              {` · ${file.fileName}`}
              {showImageNav ? ` · ${imageIndex + 1}/${imageFiles.length}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={file.downloadUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </a>
            {canWrite ? (
              <button
                type="button"
                onClick={() => onDeleteFile(file.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir arquivo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 p-1.5 text-white hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/40 p-3 sm:p-5">
          {showImageNav ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Próxima"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          {file.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.previewUrl}
              alt={file.fileName}
              className="max-h-[min(70vh,800px)] w-auto max-w-full rounded-lg object-contain"
            />
          ) : isPdf ? (
            <iframe
              title={file.fileName}
              src={file.previewUrl}
              className="h-[min(70vh,800px)] w-full rounded-lg bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-12 w-12 text-z-primary" />
              <p className="text-sm text-white/70">Pré-visualização indisponível para este tipo.</p>
              <a
                href={file.downloadUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-z-primary/40 bg-z-primary/15 px-3 py-2 text-xs font-medium text-z-lime-300"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar {file.fileName}
              </a>
            </div>
          )}
        </div>

        {item.files.length > 0 ? (
          <div className="border-t border-white/10 px-3 py-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Arquivos na pasta ({item.files.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFile(f.id)}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition",
                    f.id === file.id
                      ? "border-z-primary ring-2 ring-z-primary/40"
                      : "border-white/15 hover:border-white/35",
                  )}
                  title={f.fileName}
                >
                  {f.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#1A1A28]">
                      <FileText className="h-5 w-5 text-z-primary" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortableAssetCard({
  item,
  canWrite,
  onPreview,
  onAttach,
  onDelete,
}: {
  item: GalleryAsset;
  canWrite: boolean;
  onPreview: () => void;
  onAttach: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "z-10 opacity-60")}
    >
      <AssetCard
        item={item}
        canWrite={canWrite}
        onPreview={onPreview}
        onAttach={onAttach}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function AssetCard({
  item,
  canWrite,
  onPreview,
  onAttach,
  onDelete,
  dragHandleProps,
}: {
  item: GalleryAsset;
  canWrite: boolean;
  onPreview: () => void;
  onAttach: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const coverIsImage =
    item.files.some((f) => f.isImage) || (item.mimeType ?? "").startsWith("image/");
  const canPreview = item.hasFile && item.files.length > 0;
  const created = format(parseISO(item.createdAt), "dd MMM yyyy", { locale: ptBR });
  const coverUrl =
    item.previewUrl ?? item.files.find((f) => f.isImage)?.previewUrl ?? null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      <div className="relative">
        <button
          type="button"
          disabled={!canPreview}
          onClick={onPreview}
          className={cn(
            "relative flex h-36 w-full items-center justify-center bg-surface-elevated/60",
            canPreview ? "cursor-zoom-in transition hover:brightness-110" : "cursor-default",
          )}
          aria-label={canPreview ? `Abrir pasta ${item.title}` : item.title}
        >
          {coverUrl && coverIsImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : item.hasFile ? (
            <FileText className="h-10 w-10 text-z-primary" />
          ) : (
            <FileImage className="h-10 w-10 text-text-muted" />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {GALLERY_CATEGORY_LABELS[item.category]}
          </span>
          {item.fileCount > 0 ? (
            <span className="absolute right-2 top-2 rounded-full bg-z-primary/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {item.fileCount} arquivo{item.fileCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {canPreview && coverIsImage ? (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
              <Eye className="h-3 w-3" />
              Ver
            </span>
          ) : null}
        </button>
        {dragHandleProps ? (
          <button
            type="button"
            aria-label="Arrastar pasta"
            className="absolute bottom-2 left-2 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white hover:bg-black/70 active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
          <p className="mt-0.5 text-[11px] text-text-muted">{created}</p>
        </div>
        {item.notes ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-text-secondary">{item.notes}</p>
        ) : null}
        <p className="text-[11px] text-text-muted">
          {item.hasFile
            ? `${item.fileCount} arquivo${item.fileCount === 1 ? "" : "s"}${
                item.fileName ? ` · ${item.fileName}` : ""
              }`
            : "Pasta vazia"}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {canPreview ? (
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-z-primary/35 bg-z-primary/10 px-2.5 py-1.5 text-xs font-medium text-z-lime-300 hover:bg-z-primary/20"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver
            </button>
          ) : null}
          {canWrite && (
            <button
              type="button"
              onClick={onAttach}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium text-text-primary hover:border-z-emerald/40 hover:bg-z-emerald/10"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Adicionar arquivos
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-brand-red/80 hover:bg-brand-red/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
