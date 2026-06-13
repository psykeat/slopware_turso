import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  Loader2Icon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

import { entitySave } from "../lib/entity-capabilities";
import { cn } from "../lib/utils";
import { Dialog, DialogContent } from "./dialog";

interface ArticleImage {
  articleImageId: string;
  fileName: string;
  fileSize: number;
  altText: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

interface ArticleImageStripProps {
  articleId: string;
  primaryImageId: string | null;
  onRefreshArticle?: () => void;
  className?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArticleImageStrip({
  articleId,
  primaryImageId,
  onRefreshArticle,
  className,
}: ArticleImageStripProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<ArticleImage | null>(null);

  const { data: images = [], isLoading } = useQuery<ArticleImage[]>({
    queryKey: ["article-images", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${articleId}/images`);
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
    enabled: !!articleId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/articles/${articleId}/images`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (imageId: string) => entitySave("article", articleId, { primaryImageId: imageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      onRefreshArticle?.();
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Primary image failed");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (imageId: string) => entitySave("articleImage", imageId, { archived: true }),
    onSuccess: async (_res, deletedImageId) => {
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      onRefreshArticle?.();
      if (primaryImageId === deletedImageId) {
        await entitySave("article", articleId, { primaryImageId: null });
        queryClient.invalidateQueries({ queryKey: ["data", "article"] });
        onRefreshArticle?.();
      }
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Delete failed");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      imageId,
      direction,
    }: {
      imageId: string;
      direction: "left" | "right";
    }) => {
      const currentIndex = images.findIndex((img) => img.articleImageId === imageId);
      if (currentIndex < 0) return;
      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= images.length) return;

      const currentImg = images[currentIndex]!;
      const targetImg = images[targetIndex]!;
      const [first, second] =
        currentImg.sortOrder <= targetImg.sortOrder
          ? [currentImg, targetImg]
          : [targetImg, currentImg];

      await entitySave("articleImage", first.articleImageId, {
        sortOrder:
          first.articleImageId === currentImg.articleImageId
            ? targetImg.sortOrder
            : currentImg.sortOrder,
      });
      await entitySave("articleImage", second.articleImageId, {
        sortOrder:
          second.articleImageId === currentImg.articleImageId
            ? targetImg.sortOrder
            : currentImg.sortOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Reorder failed");
    },
  });

  const handleUpload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("Nur Bilddateien erlaubt");
      return;
    }

    setIsUploading(true);
    try {
      for (const file of list) {
        await uploadMutation.mutateAsync(file);
      }
      toast.success("Bilder hochgeladen");
      queryClient.invalidateQueries({ queryKey: ["article-images", articleId] });
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      onRefreshArticle?.();
    } catch (error: any) {
      toast.error(error?.message ?? "Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
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
    if (e.dataTransfer.files?.length) {
      await handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border bg-canvas p-3 transition-colors",
        isDragging
          ? "border-primary bg-[color-mix(in_oklab,var(--primary)_4%,var(--canvas))]"
          : "border-hairline",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Bilder
          </div>
          <div className="text-[11px] text-ink-mute">Thumbnails + Upload</div>
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-primary hover:text-primary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || uploadMutation.isPending}
        >
          <PlusIcon className="size-3.5" />
          Upload new
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleUpload(e.target.files);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center rounded border border-dashed border-hairline bg-canvas-soft">
          <Loader2Icon className="size-5 animate-spin text-ink-mute" />
        </div>
      ) : images.length === 0 ? (
        <button
          type="button"
          className="flex h-20 items-center justify-center gap-2 rounded border border-dashed border-hairline bg-canvas-soft text-[12px] text-ink-mute transition-colors hover:border-primary hover:text-primary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || uploadMutation.isPending}
        >
          <UploadCloudIcon className="size-4" />
          Bild hochladen
        </button>
      ) : (
        <div className="flex min-h-0 gap-2 overflow-x-auto pb-1">
          {images.map((image) => {
            const isPrimary = image.articleImageId === primaryImageId;
            const imageUrl = `/api/storage/article-images/${image.articleImageId}?v=${encodeURIComponent(image.articleImageId)}`;

            return (
              <div
                key={image.articleImageId}
                className={cn(
                  "group relative shrink-0 overflow-hidden rounded-md border bg-canvas shadow-sm",
                  isPrimary ? "border-primary ring-1 ring-primary" : "border-hairline",
                )}
                title={`${image.fileName} · ${formatSize(image.fileSize)}`}
              >
                <img
                  src={imageUrl}
                  alt={image.altText || image.fileName}
                  className="h-[7.5rem] w-[7.5rem] object-cover"
                  loading="lazy"
                />
                {isPrimary ? (
                  <div className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
                    <StarIcon className="size-3 fill-current" />
                  </div>
                ) : null}
                <div className="absolute inset-0 flex items-end justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100">
                  <div className="mb-1 flex items-center gap-1 rounded-full bg-canvas/95 p-1 shadow-lg">
                    {!isPrimary ? (
                      <button
                        type="button"
                        className="flex size-6 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                        title="Set primary"
                        onClick={() => setPrimaryMutation.mutate(image.articleImageId)}
                      >
                        <StarIcon className="size-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-soft hover:text-primary disabled:opacity-30"
                      title="Move left"
                      disabled={reorderMutation.isPending}
                      onClick={() =>
                        reorderMutation.mutate({ imageId: image.articleImageId, direction: "left" })
                      }
                    >
                      <ArrowLeftIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-soft hover:text-primary disabled:opacity-30"
                      title="Move right"
                      disabled={reorderMutation.isPending}
                      onClick={() =>
                        reorderMutation.mutate({
                          imageId: image.articleImageId,
                          direction: "right",
                        })
                      }
                    >
                      <ArrowRightIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                      title="Preview"
                      onClick={() => setPreviewImage(image)}
                    >
                      <EyeIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-soft hover:text-destructive"
                      title="Archive"
                      onClick={() => {
                        if (confirm("Möchten Sie dieses Bild wirklich archivieren?")) {
                          archiveMutation.mutate(image.articleImageId);
                        }
                      }}
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center rounded-md border border-dashed border-hairline bg-canvas-soft text-ink-mute transition-colors hover:border-primary hover:text-primary"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || uploadMutation.isPending}
            title="Upload new"
          >
            <UploadCloudIcon className="size-5" />
          </button>
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          {previewImage ? (
            <div className="bg-canvas">
              <div className="border-b border-hairline px-4 py-3">
                <div className="text-[13px] font-medium text-ink">{previewImage.fileName}</div>
                <div className="text-[11px] text-ink-mute">{formatSize(previewImage.fileSize)}</div>
              </div>
              <div className="flex items-center justify-center bg-canvas-soft p-4">
                <img
                  src={`/api/storage/article-images/${previewImage.articleImageId}?v=${encodeURIComponent(previewImage.articleImageId)}`}
                  alt={previewImage.altText || previewImage.fileName}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
