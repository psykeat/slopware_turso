import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloudIcon,
  Trash2Icon,
  StarIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
  FileImageIcon,
} from "lucide-react";
import React, { useState, useRef } from "react";
import { toast } from "sonner";

import { entitySave } from "../lib/entity-capabilities";

interface ArticleImage {
  articleImageId: string;
  tenantId: string;
  articleId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

interface ArticleImagesTabProps {
  articleId: string;
  primaryImageId: string | null;
  onRefreshArticle?: () => void;
}

export function ArticleImagesTab({
  articleId,
  primaryImageId,
  onRefreshArticle,
}: ArticleImagesTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch images for this article
  const { data: images = [], isLoading } = useQuery<ArticleImage[]>({
    queryKey: ["article-images", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${articleId}/images`);
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
    enabled: !!articleId,
  });

  // Mutate: Upload Image
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/articles/${articleId}/images`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      return res.json() as Promise<ArticleImage>;
    },
    onSuccess: () => {
      toast.success("Bild erfolgreich hochgeladen");
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      onRefreshArticle?.();
    },
    onError: (error) => {
      toast.error(`Upload fehlgeschlagen: ${error.message}`);
    },
  });

  // Mutate: Set Primary Image
  const setPrimaryMutation = useMutation({
    mutationFn: (imageId: string) => entitySave("article", articleId, { primaryImageId: imageId }),
    onSuccess: () => {
      toast.success("Hauptbild aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      onRefreshArticle?.();
    },
    onError: (error: any) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Mutate: Delete Image (Soft Delete / Archive)
  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => entitySave("articleImage", imageId, { archived: true }),
    onSuccess: (data, deletedImageId) => {
      toast.success("Bild gelöscht");
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });

      // If the deleted image was the primary image, clear primaryImageId on the article
      if (primaryImageId === deletedImageId) {
        void entitySave("article", articleId, { primaryImageId: null }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["data", "article"] });
          onRefreshArticle?.();
        });
      }
    },
    onError: (error: any) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Mutate: Reorder Images (update sortOrder)
  const updateOrderMutation = useMutation({
    mutationFn: async ({
      imageId,
      direction,
    }: {
      imageId: string;
      direction: "left" | "right";
    }) => {
      const currentIndex = images.findIndex((img) => img.articleImageId === imageId);
      if (currentIndex === -1) return;

      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= images.length) return;

      const currentImg = images[currentIndex]!;
      const targetImg = images[targetIndex]!;

      // Swap sortOrder
      const currentSort = currentImg.sortOrder;
      const targetSort = targetImg.sortOrder;

      // Make sequential updates to database
      await entitySave("articleImage", currentImg.articleImageId, { sortOrder: targetSort });
      await entitySave("articleImage", targetImg.articleImageId, { sortOrder: currentSort });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
    },
    onError: (error: any) => {
      toast.error(`Reihenfolge konnte nicht geändert werden: ${error.message}`);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file) {
          await uploadMutation.mutateAsync(file);
        }
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file && file.type.startsWith("image/")) {
          await uploadMutation.mutateAsync(file);
        } else {
          toast.error("Es können nur Bilddateien hochgeladen werden");
        }
      }
      setIsUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full flex-col space-y-4 p-4">
      {/* ── DRAG & DROP UPLOAD ZONE ────────────────────────────────────────── */}
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-200 ${
          isDragging
            ? "scale-[1.01] border-primary bg-primary/5 text-primary"
            : "border-hairline bg-canvas hover:border-primary hover:bg-canvas-soft"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          multiple
          className="hidden"
        />
        {isUploading || uploadMutation.isPending ? (
          <>
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <p className="mt-2 text-[13px] font-medium text-ink">Bilder werden hochgeladen...</p>
          </>
        ) : (
          <>
            <UploadCloudIcon className="size-8 text-ink-mute" />
            <p className="mt-2 text-[13px] font-medium text-ink">
              Bilder hierher ziehen oder anklicken zum Hochladen
            </p>
            <p className="text-[11px] text-ink-mute">Unterstützt PNG, JPG, GIF (max. 10MB)</p>
          </>
        )}
      </button>

      {/* ── IMAGE GALLERY LISTING ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2Icon className="size-6 animate-spin text-ink-mute" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-12">
          <FileImageIcon className="size-10 text-ink-mute" />
          <p className="mt-2 text-[13px] font-semibold text-ink">Keine Bilder vorhanden</p>
          <p className="text-[11px] text-ink-mute">
            Laden Sie ein Bild hoch, um es diesem Artikel zuzuweisen.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {images.map((image, index) => {
              const isPrimary = image.articleImageId === primaryImageId;
              const imageUrl = `/api/storage/article-images/${image.articleImageId}?v=${encodeURIComponent(image.articleImageId)}`;

              return (
                <div
                  key={image.articleImageId}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-canvas transition-all duration-200 hover:shadow-md ${
                    isPrimary ? "border-primary ring-1 ring-primary" : "border-hairline"
                  }`}
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-square w-full bg-canvas-soft">
                    <img
                      src={imageUrl}
                      alt={image.altText || image.fileName}
                      className="h-full w-full object-cover"
                    />

                    {/* Primary Star Indicator */}
                    {isPrimary && (
                      <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow">
                        <StarIcon className="size-3.5 fill-current" />
                      </div>
                    )}

                    {/* Action Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="flex items-center gap-1.5 rounded-full bg-canvas p-1 shadow-lg">
                        {/* Make Primary */}
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrimaryMutation.mutate(image.articleImageId);
                            }}
                            title="Als Hauptbild festlegen"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink transition hover:bg-canvas-soft hover:text-primary"
                          >
                            <StarIcon className="size-4" />
                          </button>
                        )}

                        {/* Reorder Left */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderMutation.mutate({
                              imageId: image.articleImageId,
                              direction: "left",
                            });
                          }}
                          title="Nach links verschieben"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink transition hover:bg-canvas-soft hover:text-primary disabled:opacity-30 disabled:hover:text-ink"
                        >
                          <ArrowLeftIcon className="size-4" />
                        </button>

                        {/* Reorder Right */}
                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderMutation.mutate({
                              imageId: image.articleImageId,
                              direction: "right",
                            });
                          }}
                          title="Nach rechts verschieben"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink transition hover:bg-canvas-soft hover:text-primary disabled:opacity-30 disabled:hover:text-ink"
                        >
                          <ArrowRightIcon className="size-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Möchten Sie dieses Bild wirklich löschen?")) {
                              deleteMutation.mutate(image.articleImageId);
                            }
                          }}
                          title="Bild löschen"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink transition hover:bg-canvas-soft hover:text-destructive"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Meta Details */}
                  <div className="flex flex-col p-2 text-left">
                    <span
                      className="truncate text-[11px] font-semibold text-ink"
                      title={image.fileName}
                    >
                      {image.fileName}
                    </span>
                    <span className="text-[10px] text-ink-mute">{formatSize(image.fileSize)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
