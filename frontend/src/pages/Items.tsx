import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Link2, Image as ImageIcon, Video, ExternalLink, Copy, Trash2, CheckSquare, Square, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, normalizeItems } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Item {
  id: number;
  type: string;
  title: string;
  content: string;
  description?: string;
  raw_content?: string;
  tags: string[];
  folder: string;
  created_at: string;
  sourceUrl?: string;
  preview?: {
    type: string;
    value: string;
  } | null;
  thumbnail?: string | null;
  spaceId?: number | null;
  space_id?: number | null;
}

const Items = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { toast } = useToast();
  const clickTimerRef = useRef<number | null>(null);
  
  const activeTab = searchParams.get("type") || "note";

  const getPreviewData = (item: Item) => {
    const preview = item.preview;
    const value = preview?.value || item.content || "";
    const type = preview?.type || item.type;
    return { type, value };
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/v1/items/", "GET");
      const normalized = normalizeItems(response.items || []);
      setItems(normalized);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCardClick = (e: React.MouseEvent, item: Item) => {
    // Prevent bubbling to page-level click-away handler
    e.stopPropagation();
    if (selectionMode) {
      // In selection mode, single click toggles selection
      toggleSelect(item.id);
      return;
    }
    // Delay opening to allow double-click to cancel this action
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }
    const t = window.setTimeout(() => {
      setSelectedItem(item);
      setDetailDialogOpen(true);
      clickTimerRef.current = null;
    }, 220);
    clickTimerRef.current = t as unknown as number;
  };

  const handleCardDoubleClick = (e: React.MouseEvent, item: Item) => {
    // Cancel pending single-click open
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    e.preventDefault();
    e.stopPropagation();
    // Enter selection mode and select this item
    if (!selectionMode) setSelectionMode(true);
    setSelectedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const visibleItems: Item[] = useMemo(() => {
    const map: Record<string, Item[]> = {
      note: items.filter((i) => i.type === "note"),
      link: items.filter((i) => i.type === "link"),
      image: items.filter((i) => i.type === "image"),
      video: items.filter((i) => i.type === "video"),
      article: items.filter((i) => i.type === "article"),
    };
    return map[activeTab] ?? [];
  }, [items, activeTab]);

  const selectAllVisible = () => setSelectedIds(visibleItems.map((i) => i.id));

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    setBulkDeleteOpen(false);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => apiRequest(`/api/v1/items/${id}/`, "DELETE"))
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.length - fulfilled;
      if (fulfilled > 0) {
        setItems((prev) => prev.filter((it) => !ids.includes(it.id)));
      }
      setSelectedIds([]);
      setSelectionMode(false);
      toast({
        title: rejected === 0 ? "Deleted" : "Partial delete",
        description:
          rejected === 0
            ? `${fulfilled} item(s) deleted successfully.`
            : `${fulfilled} deleted, ${rejected} failed.`,
        variant: rejected === 0 ? undefined : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete", variant: "destructive" });
    }
  };

  const renderMasonryGrid = (itemList: Item[]) => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4">
              <div className="h-40 bg-secondary/20 rounded-lg" />
            </div>
          ))}
        </div>
      );
    }

    if (!itemList || itemList.length === 0) {
      return (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold mb-2">No items yet</h3>
          <p className="text-muted-foreground">Click the "Add" button to create your first item</p>
        </div>
      );
    }

    return (
      <div className="mx-auto" style={{ maxWidth: '1200px', padding: '0 8px' }}>
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5" style={{ columnGap: '12px' }}>
          {itemList.map((item, idx) => (
            <div
              key={item.id}
              className="inline-block w-full mb-3 break-inside-avoid cursor-pointer relative group"
              style={{ breakInside: 'avoid' }}
              onClick={(e) => handleCardClick(e, item)}
              onDoubleClick={(e) => handleCardDoubleClick(e, item)}
            >
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={selectedIds.includes(item.id) ? "Unselect" : "Select"}
                  />
                </div>
              )}
              <div
                className={`rounded-[12px] p-3 ${selectionMode ? 'pt-10 pl-8' : ''} mb-0 text-white transition ring-2 ${
                  selectionMode && selectedIds.includes(item.id)
                    ? "ring-primary/70"
                    : "ring-transparent group-hover:ring-white/10"
                }`}
                style={{ backgroundColor: `hsl(${(idx * 12) % 360} 18% 14%)` }}
              >
                {(() => {
                  const { type: previewType, value: previewValue } = getPreviewData(item);
                  const destination = item.sourceUrl || (typeof previewValue === "string" ? previewValue : "");

                  if (previewType === "image" && typeof previewValue === "string" && previewValue.startsWith("http")) {
                    return <img src={previewValue} alt={item.title || ""} className="w-full max-h-48 object-contain rounded-[8px]" />;
                  }

                  if (previewType === "video" && typeof previewValue === "string") {
                    const isEmbed = /youtube\.com\/embed|player\.vimeo\.com/i.test(previewValue);
                    return isEmbed ? (
                      <iframe
                        src={previewValue}
                        title={item.title || "Video preview"}
                        className="w-full max-h-48 rounded-[8px]"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video src={previewValue} className="w-full max-h-48 rounded-[8px] object-contain" controls preload="metadata" />
                    );
                  }

                  if (previewType === "pdf" && typeof previewValue === "string") {
                    return (
                      <iframe
                        src={previewValue}
                        title={item.title || "PDF preview"}
                        className="w-full h-48 rounded-[8px] bg-white"
                      />
                    );
                  }

                  if (previewType === "link") {
                    return (
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
                              try { navigator.clipboard.writeText(destination || ""); } catch {}
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
                            className="text-primary"
                            aria-label="Open link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  }

                  const textValue = typeof previewValue === "string" && previewValue.length > 0 ? previewValue : (item.title || item.description || item.content);
                  return <div className="text-sm leading-snug whitespace-pre-wrap text-white">{textValue}</div>;
                })()}

                {item.sourceUrl && (
                  <div className="mt-3 text-xs text-white/70 flex items-center gap-2">
                    <Link2 className="w-3 h-3" />
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.sourceUrl.replace(/^https?:\/\//i, "")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await apiRequest(`/api/v1/items/${itemToDelete}/`, "DELETE");
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      setItems(items.filter(item => item.id !== itemToDelete));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const groupedItems = {
    note: items.filter(item => item.type === "note"),
    link: items.filter(item => item.type === "link"),
    image: items.filter(item => item.type === "image"),
    video: items.filter(item => item.type === "video"),
    article: items.filter(item => item.type === "article"),
  };

  const renderItemCard = (item: Item) => {
    const { type: previewType, value: previewValue } = getPreviewData(item);
    const destination = item.sourceUrl || (typeof previewValue === "string" ? previewValue : "");
    const readableText = typeof previewValue === "string" && previewValue.length > 0
      ? previewValue
      : (item.description || item.title || item.content);

    return (
      <Card
        key={item.id}
        className="group hover:shadow-lg transition-all cursor-pointer"
        onClick={() => {
          setSelectedItem(item);
          setDetailDialogOpen(true);
        }}
      >
        <CardContent className="p-4">
          {previewType === "image" && typeof previewValue === "string" && previewValue.startsWith("http") && (
            <div className="aspect-video w-full bg-secondary/50 overflow-hidden rounded-lg mb-3">
              <img
                src={previewValue}
                alt={item.description || item.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {previewType === "video" && typeof previewValue === "string" && (
            <div className="aspect-video w-full bg-secondary/50 overflow-hidden rounded-lg mb-3">
              {/youtube\.com\/embed|player\.vimeo\.com/i.test(previewValue) ? (
                <iframe
                  src={previewValue}
                  title={item.title || "Video preview"}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewValue}
                  className="w-full h-full object-cover"
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}

          {previewType === "pdf" && typeof previewValue === "string" && (
            <div className="aspect-video w-full bg-secondary/50 overflow-hidden rounded-lg mb-3">
              <iframe
                src={previewValue}
                title={item.title || "PDF preview"}
                className="w-full h-full"
              />
            </div>
          )}

          {previewType === "text" && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-4 whitespace-pre-wrap">
              {readableText}
            </p>
          )}

          {previewType === "link" && destination && (
            <div className="text-sm text-muted-foreground mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3 h-3 text-primary" />
                <a
                  href={destination}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.title || item.description || destination.replace(/^https?:\/\//i, "")}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { navigator.clipboard.writeText(destination); } catch {}
                  }}
                  aria-label="Copy link"
                  className="rounded-full p-1.5 hover:bg-secondary transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={destination}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full p-1.5 hover:bg-secondary transition"
                  aria-label="Open link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {item.type === "article" && previewType !== "pdf" && destination && (
            <div className="mb-3">
              <a
                href={destination}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:underline flex items-center gap-2"
                aria-label="Open article"
              >
                <FileText className="w-4 h-4" />
                <span>{item.title || item.description || 'Open article'}</span>
              </a>
            </div>
          )}

          <div className="flex flex-wrap gap-1 mb-3">
            {(item.tags || []).map((tag, idx) => (
              <span
                key={`${item.id}-${tag}-${idx}`}
                className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent border border-accent/30"
              >
                {tag}
              </span>
            ))}
          </div>

          {item.sourceUrl && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <Link2 className="w-3 h-3" />
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline truncate"
              >
                {item.sourceUrl.replace(/^https?:\/\//i, "")}
              </a>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderItemGrid = (itemList: Item[]) => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (itemList.length === 0) {
      return (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold mb-2">No items yet</h3>
          <p className="text-muted-foreground">Click the "Add" button to create your first item</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {itemList.map(renderItemCard)}
      </div>
    );
  };

  return (
    <DashboardLayout onItemAdded={fetchItems}>
      {/* Click-away to exit selection mode */}
      <div
        className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        onClick={() => {
          if (selectionMode) {
            setSelectionMode(false);
            setSelectedIds([]);
          }
        }}
      >
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold sm:text-3xl">All Items</h1>
              <p className="text-muted-foreground">Browse and manage your content by type</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!selectionMode ? (
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectionMode(true);
                  }}
                >
                  <CheckSquare className="w-4 h-4 mr-2" /> Select
                </Button>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground mr-2">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllVisible();
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedIds.length === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBulkDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ type: value })}>
          <div className="mb-6 overflow-x-auto">
            <TabsList className="inline-flex min-w-max gap-2 bg-secondary/8 p-1 rounded-[12px] shadow-sm">
              <TabsTrigger
                value="note"
                className="px-3 py-2 rounded-[10px] text-sm flex items-center gap-2 transition-all text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/70 data-[state=active]:to-accent/60 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <FileText className="w-4 h-4" />
                <span>Notes</span>
                <span className="ml-1 text-xs text-muted-foreground">({groupedItems.note.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="link"
                className="px-3 py-2 rounded-[10px] text-sm flex items-center gap-2 transition-all text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/70 data-[state=active]:to-accent/60 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <Link2 className="w-4 h-4" />
                <span>Links</span>
                <span className="ml-1 text-xs text-muted-foreground">({groupedItems.link.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="px-3 py-2 rounded-[10px] text-sm flex items-center gap-2 transition-all text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/70 data-[state=active]:to-accent/60 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Images</span>
                <span className="ml-1 text-xs text-muted-foreground">({groupedItems.image.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="px-3 py-2 rounded-[10px] text-sm flex items-center gap-2 transition-all text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/70 data-[state=active]:to-accent/60 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <Video className="w-4 h-4" />
                <span>Videos</span>
                <span className="ml-1 text-xs text-muted-foreground">({groupedItems.video.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="article"
                className="px-3 py-2 rounded-[10px] text-sm flex items-center gap-2 transition-all text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/70 data-[state=active]:to-accent/60 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <FileText className="w-4 h-4" />
                <span>Articles</span>
                <span className="ml-1 text-xs text-muted-foreground">({groupedItems.article.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            {renderMasonryGrid(items)}
          </TabsContent>

          <TabsContent value="note">
            {renderMasonryGrid(groupedItems.note)}
          </TabsContent>

          <TabsContent value="link">
            {renderMasonryGrid(groupedItems.link)}
          </TabsContent>

          <TabsContent value="image">
            {renderMasonryGrid(groupedItems.image)}
          </TabsContent>

          <TabsContent value="video">
            {renderMasonryGrid(groupedItems.video)}
          </TabsContent>

          <TabsContent value="article">
            {renderMasonryGrid(groupedItems.article)}
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this item.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected items?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selectedIds.length} item(s). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ItemDetailDialog
          item={selectedItem}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onItemUpdated={fetchItems}
          onItemDeleted={fetchItems}
        />
      </div>
    </DashboardLayout>
  );
};

export default Items;
