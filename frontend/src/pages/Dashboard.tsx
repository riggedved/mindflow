import { useCallback, useEffect, useState } from "react";
import { FileText, Link2, Copy, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import FloatingExtensionButton from "@/components/FloatingExtensionButton";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, normalizeItems } from "@/lib/api";

interface Item {
  id: number;
  type: string;
  title: string;
  content: string;
  description?: string;
  raw_content?: string;
  tags: string[];
  created_at: string;
  folder: string;
  ai_meta?: unknown;
  sourceUrl?: string;
  preview?: {
    type?: string;
    value?: string;
  } | null;
  thumbnail?: string | null;
}

const Dashboard = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/v1/items/", "GET");
      const payload = Array.isArray(response) ? response : response.items ?? [];
      const normalized = normalizeItems(payload) as Item[];
      setItems(normalized.slice(0, 24));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch dashboard items";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  const handleItemUpdated = () => {
    fetchItems();
  };

  const handleItemDeleted = () => {
    fetchItems();
    setSelectedItem(null);
    setDetailDialogOpen(false);
  };

  const getPreviewData = (item: Item) => {
    const preview = item.preview;
    const type = preview?.type || item.type;
    const value = preview?.value || item.content || "";
    return { type, value, sourceUrl: item.sourceUrl };
  };

  const renderMasonryGrid = () => (
    <div className="mx-auto" style={{ maxWidth: "1200px", padding: "0 8px" }}>
      <div
        className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5"
        style={{ columnGap: "12px" }}
      >
        {items.map((item, idx) => {
          const { type: previewType, value: previewValue, sourceUrl } = getPreviewData(item);
          const destination = sourceUrl || (typeof previewValue === "string" ? previewValue : "");

          return (
            <div
              key={item.id}
              className="inline-block w-full mb-3 break-inside-avoid cursor-pointer"
              style={{ breakInside: "avoid" }}
              onClick={() => handleItemClick(item)}
            >
              <div
                className="rounded-[12px] p-3 mb-0 text-white"
                style={{ backgroundColor: `hsl(${(idx * 12) % 360} 18% 14%)` }}
              >
                {previewType === "image" && typeof previewValue === "string" && previewValue.startsWith("http") && (
                  <img
                    src={previewValue}
                    alt={item.title || ""}
                    className="w-full max-h-48 object-contain rounded-[8px]"
                  />
                )}

                {previewType === "video" && typeof previewValue === "string" && (
                  /youtube\.com\/embed|player\.vimeo\.com/i.test(previewValue) ? (
                    <iframe
                      src={previewValue}
                      title={item.title || "Video preview"}
                      className="w-full max-h-48 rounded-[8px]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={previewValue}
                      className="w-full max-h-48 rounded-[8px] object-contain"
                      controls
                      preload="metadata"
                    />
                  )
                )}

                {previewType === "pdf" && typeof previewValue === "string" && (
                  <iframe
                    src={previewValue}
                    title={item.title || "PDF preview"}
                    className="w-full h-48 rounded-[8px] bg-white"
                  />
                )}

                {previewType === "link" && destination && (
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={destination}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.title || item.description || destination.replace(/^https?:\/\//i, "")}
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            navigator.clipboard.writeText(destination);
                          } catch (error) {
                            console.warn("Failed to copy item link", error);
                          }
                        }}
                        aria-label="Copy link"
                        className="opacity-80 hover:opacity-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={destination}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Open link"
                        className="text-primary"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}

                {previewType !== "image" &&
                  previewType !== "video" &&
                  previewType !== "pdf" &&
                  previewType !== "link" && (
                    <div className="text-sm leading-snug whitespace-pre-wrap text-white">
                      {typeof previewValue === "string" && previewValue.length > 0
                        ? previewValue
                        : item.title || item.description || item.content || ""}
                    </div>
                  )}

                {sourceUrl && (
                  <div className="mt-3 text-xs text-white/70 flex items-center gap-2">
                    <Link2 className="w-3 h-3" />
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sourceUrl.replace(/^https?:\/\//i, "")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <DashboardLayout onItemAdded={fetchItems}>
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your latest content</p>
        </div>

        {loading && (
          <div className="px-2">
            <div className="mx-auto" style={{ maxWidth: "1200px", padding: "0 8px" }}>
              <div
                className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5"
                style={{ columnGap: "12px" }}
              >
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="inline-block w-full mb-3 break-inside-avoid"
                    style={{ breakInside: "avoid" }}
                  >
                    <div
                      className="rounded-[12px] p-3 text-white/70 bg-muted/10 border border-white/5 animate-pulse"
                      style={{ backgroundColor: `hsl(${(idx * 12) % 360} 18% 14%)` }}
                    >
                      <Skeleton className="w-full h-36 rounded-[8px] mb-4" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-5/6 mb-1" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No items yet</h3>
            <p className="text-muted-foreground mb-6">Click the "Add" button to create your first item</p>
          </div>
        )}

        {!loading && items.length > 0 && <div className="px-2">{renderMasonryGrid()}</div>}
      </div>

      <ItemDetailDialog
        item={selectedItem}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
      />

      <FloatingExtensionButton />
    </DashboardLayout>
  );
};

export default Dashboard;
