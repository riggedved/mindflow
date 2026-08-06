import { useState, useEffect } from "react";
import { Trash2, Loader2, Plus, ArrowLeft, Sparkles, Search, ExternalLink, Copy, Link2, CheckSquare } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api, normalizeItems } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";

interface SpaceDetailProps {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  item_count: number;
  is_suggested: boolean;
  created_at: string;
}

interface Item {
  id: number;
  type: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  folder: string;
  created_at: string;
  sourceUrl?: string;
  url?: string;
  mimeType?: string;
  storagePath?: string;
  publicUrl?: string;
  aiMeta?: any;
  pageContentType?: string;
  preview?: {
    type?: string;
    value?: string;
  } | null;
  thumbnail?: string | null;
  spaceId?: number | null;
  space_id?: number | null;
}

const normalizeSpaceItem = (input: any): Item => ({
  id: input.id,
  type: input.type,
  title: input.title || input.description || "Untitled",
  content: input.content || input.raw_content || "",
  description: input.description,
  tags: Array.isArray(input.tags) ? input.tags : [],
  folder: input.folder || input.ai_meta?.category || "general",
  created_at: input.created_at || new Date().toISOString(),
  sourceUrl: input.sourceUrl || input.source_url || (typeof input.url === "string" ? input.url : undefined),
  url: typeof input.url === "string" ? input.url : undefined,
  mimeType: input.mime_type || input.mimeType || input.ai_meta?.mime_type,
  storagePath: typeof input.storage_path === "string" ? input.storage_path : undefined,
  publicUrl: typeof input.public_url === "string" ? input.public_url : undefined,
  aiMeta: input.ai_meta || input.aiMeta || null,
  pageContentType:
    input.ai_meta?.page?.content_type ||
    input.ai_meta?.page?.contentType ||
    (typeof input.ai_meta?.page?.headers?.get === "function"
      ? input.ai_meta.page.headers.get("content-type")
      : input.ai_meta?.page?.headers?.["content-type"]),
  preview: input.preview || input.ai_meta?.preview || null,
  thumbnail: input.thumbnail || input.ai_meta?.thumbnail || null,
  spaceId: input.space_id ?? input.spaceId ?? null,
  space_id: input.space_id ?? input.spaceId ?? null,
});

const resolveMediaUrl = (input?: string | null) => {
  if (!input) {
    return undefined;
  }

  if (/^(?:https?:)?\/\//i.test(input) || input.startsWith("data:")) {
    if (input.startsWith("//")) {
      const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
      return `${protocol}${input}`;
    }
    return input;
  }

  if (input.startsWith("/")) {
    return `${API_BASE_URL}${input}`;
  }

  return input;
};

const isPdfUrl = (value?: string) => {
  if (!value) {
    return false;
  }
  return /\.pdf(?:$|[?#])/i.test(value);
};

const isPdfMime = (value?: string) => {
  if (!value) {
    return false;
  }
  return /pdf/i.test(value);
};

const getPreviewData = (item: Item) => {
  const preview = item.preview;
  const rawType = preview?.type || item.type || "";
  let type = rawType.toLowerCase();

  const resolvedPreviewValue = resolveMediaUrl(typeof preview?.value === "string" ? preview.value : undefined);
  const resolvedContentValue = resolveMediaUrl(typeof item.content === "string" ? item.content : undefined);
  const resolvedSourceUrl = resolveMediaUrl(item.sourceUrl || item.url);
  const resolvedPublicUrl = resolveMediaUrl(item.publicUrl);
  const resolvedStorageUrl = resolveMediaUrl(item.storagePath);

  let value: string | undefined =
    resolvedPreviewValue ||
    resolvedContentValue ||
    resolvedSourceUrl ||
    resolvedPublicUrl ||
    resolvedStorageUrl;

  const pdfDetected =
    rawType === "article" ||
    isPdfUrl(resolvedPreviewValue || resolvedSourceUrl || resolvedContentValue || resolvedPublicUrl || resolvedStorageUrl) ||
    isPdfMime(item.mimeType) ||
    (typeof item.pageContentType === "string" && item.pageContentType.toLowerCase().includes("pdf"));

  if (type !== "pdf" && pdfDetected) {
    type = "pdf";
  }

  if (!value && type === "pdf") {
    value = resolvedSourceUrl || resolvedPublicUrl || resolvedStorageUrl || resolvedContentValue;
  }

  return {
    type: type || rawType || "",
    value: value ?? "",
    sourceUrl: resolvedSourceUrl,
  };
};

const SpaceDetail = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [space, setSpace] = useState<SpaceDetailProps | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Add Items Dialog
  const [addItemsDialogOpen, setAddItemsDialogOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedAvailableItemIds, setSelectedAvailableItemIds] = useState<number[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [addingItems, setAddingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSpaceItemIds, setSelectedSpaceItemIds] = useState<number[]>([]);
  const [removingItems, setRemovingItems] = useState(false);
  
  // Item Detail Dialog
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedSpaceItemIds([]);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (spaceId) {
      loadSpaceDetails();
    }
  }, [spaceId]);

  const loadSpaceDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/spaces/${spaceId}`);

      setSpace({
        id: response.id,
        name: response.name,
        description: response.description,
        color: response.color,
        icon: response.icon,
        item_count: response.item_count,
        is_suggested: response.is_suggested || false,
        created_at: response.created_at,
      });
    // Map items to include folder field and description
    const mappedItems = (normalizeItems(response.items || []) as any[]).map(normalizeSpaceItem);
    setItems(mappedItems);
    setSelectionMode(false);
    setSelectedSpaceItemIds([]);
    } catch (error: any) {
      console.error("Error loading space details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load space details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openItemDetail = (item: Item) => {
    setSelectedItem(item);
    setItemDetailOpen(true);
  };

  const loadAvailableItems = async () => {
    try {
      setLoadingItems(true);
      const response = await api.get("/api/v1/items/");
  const allItems = (normalizeItems(response.items || []) as any[]).map(normalizeSpaceItem);
      // Filter out items already in this space
      const currentItemIds = items.map(item => item.id);
      const available = allItems.filter((item: Item) => !currentItemIds.includes(item.id));
      setAvailableItems(available);
    } catch (error: any) {
      console.error("Error loading items:", error);
      toast({
        title: "Error",
        description: "Failed to load available items",
        variant: "destructive",
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const openAddItemsDialog = () => {
    setAddItemsDialogOpen(true);
  setSelectedAvailableItemIds([]);
    setSearchQuery(""); // Reset search
    loadAvailableItems();
  };

  const addItemsToSpace = async () => {
  if (selectedAvailableItemIds.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to add",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddingItems(true);
      await api.post(`/api/v1/spaces/${spaceId}/items`, {
        item_ids: selectedAvailableItemIds,
      });
      
      toast({
        title: "Success",
  description: `Added ${selectedAvailableItemIds.length} item(s) to space`,
      });
      
  setAddItemsDialogOpen(false);
  setSelectedAvailableItemIds([]);
      loadSpaceDetails(); // Reload to show new items
    } catch (error: any) {
      console.error("Error adding items:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add items",
        variant: "destructive",
      });
    } finally {
      setAddingItems(false);
    }
  };

  const toggleAvailableItemSelection = (itemId: number) => {
    setSelectedAvailableItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSpaceItemSelection = (itemId: number) => {
    setSelectedSpaceItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSpaceItemClick = (item: Item) => {
    if (selectionMode) {
      toggleSpaceItemSelection(item.id);
      return;
    }
    openItemDetail(item);
  };

  // Bulk detach items from the current space via the new removal endpoint.
  const removeSelectedItems = async () => {
    if (!spaceId || selectedSpaceItemIds.length === 0) {
      return;
    }

    try {
      setRemovingItems(true);
      await api.post(`/api/v1/spaces/${spaceId}/items/remove`, {
        item_ids: selectedSpaceItemIds,
      });
      toast({
        title: "Items removed",
        description: `Removed ${selectedSpaceItemIds.length} item(s) from this space`,
      });
      setSelectedSpaceItemIds([]);
      setSelectionMode(false);
      await loadSpaceDetails();
    } catch (error: any) {
      console.error("Error removing items:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove items",
        variant: "destructive",
      });
    } finally {
      setRemovingItems(false);
    }
  };

  // Filter items based on search query
  const filteredItems = availableItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.content?.toLowerCase().includes(query) ||
      item.type?.toLowerCase().includes(query) ||
      item.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const deleteSpace = async () => {
    try {
      setDeleting(true);
      await api.delete(`/api/v1/spaces/${spaceId}`);
      toast({
        title: "Success",
        description: "Space deleted successfully",
      });
      navigate("/spaces");
    } catch (error: any) {
      console.error("Error deleting space:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete space",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!space) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen">
          <h2 className="text-2xl font-bold mb-4">Space not found</h2>
          <Button onClick={() => navigate("/spaces")}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Spaces
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Create theme colors based on space color
  const themeColor = space.color;
  const lightTheme = `${themeColor}15`; // 15% opacity for backgrounds
  const mediumTheme = `${themeColor}30`; // 30% opacity
  const accentTheme = `${themeColor}50`; // 50% opacity for accents

  return (
    <DashboardLayout>
      <div className="min-h-screen" style={{ background: `linear-gradient(to bottom right, ${lightTheme}, transparent)` }}>
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/spaces")}
              className="mb-4 hover:bg-white/50 w-full justify-start sm:w-auto"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Spaces
            </Button>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: mediumTheme }}
                >
                  <div className="text-4xl" style={{ color: themeColor }}>
                    {space.icon === "Sparkles" ? "✨" : space.icon === "Lightbulb" ? "💡" : "📁"}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: themeColor }}>
                      {space.name}
                    </h1>
                    {space.is_suggested && (
                      <Badge
                        style={{
                          backgroundColor: accentTheme,
                          color: themeColor,
                          borderColor: themeColor,
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Created
                      </Badge>
                    )}
                  </div>
                  {space.description && (
                    <p className="text-lg text-muted-foreground max-w-2xl">
                      {space.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <Badge variant="outline" className="text-sm">
                      {space.item_count} {space.item_count === 1 ? "item" : "items"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Created {new Date(space.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 self-start">
                <Button
                  variant="outline"
                  size="icon"
                  className="hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div
            className="rounded-2xl p-6 shadow-lg backdrop-blur-xl flex flex-col gap-4 min-h-[420px]"
            style={{
              background: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35))`,
              border: `1px solid ${mediumTheme}`,
              color: "white",
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: themeColor }}>
                  Items in this Space
                </h2>
                {selectionMode && (
                  <p className="mt-1 text-sm text-white/70">
                    {selectedSpaceItemIds.length} selected
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
                {selectionMode ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedSpaceItemIds([]);
                      }}
                      disabled={removingItems}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={removeSelectedItems}
                      disabled={removingItems || selectedSpaceItemIds.length === 0}
                    >
                      {removingItems ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 w-4 h-4" />
                          Remove{selectedSpaceItemIds.length ? ` (${selectedSpaceItemIds.length})` : ""}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setSelectionMode(true)}
                  >
                    <CheckSquare className="mr-2 w-4 h-4" />
                    Select Items
                  </Button>
                )}
                <Button
                  style={{
                    backgroundColor: themeColor,
                    color: "white",
                  }}
                  className="w-full hover:opacity-90 sm:w-auto"
                  onClick={openAddItemsDialog}
                  disabled={selectionMode}
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Add Items
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-20 h-20 rounded-full mb-4 flex items-center justify-center"
                    style={{ backgroundColor: lightTheme }}
                  >
                    <div className="text-4xl" style={{ color: themeColor }}>📦</div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No items yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start adding items to organize your knowledge in this space
                  </p>
                  <Button
                    variant="outline"
                    style={{ borderColor: themeColor, color: themeColor }}
                    onClick={openAddItemsDialog}
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    Add Your First Item
                  </Button>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[1200px] px-2 sm:px-3 2xl:w-full">
                  <div className="lg:w-[60vw] columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5" style={{ columnGap: "12px" }}>
                    {items.map((item, idx) => {
                      const { type: previewType, value: previewValue, sourceUrl } = getPreviewData(item);
                      const destination = sourceUrl || (typeof previewValue === "string" ? previewValue : "");

                      return (
                      <div
                        key={item.id}
                        className="relative inline-block w-full mb-3 break-inside-avoid cursor-pointer"
                        style={{ breakInside: "avoid" }}
                        onClick={() => handleSpaceItemClick(item)}
                      >
                        {selectionMode && (
                          <div
                            className="absolute top-3 left-3 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Checkbox
                              checked={selectedSpaceItemIds.includes(item.id)}
                              onCheckedChange={() => toggleSpaceItemSelection(item.id)}
                              style={{ borderColor: themeColor }}
                            />
                          </div>
                        )}
                        <div
                          className={`rounded-[12px] p-3 mb-0 text-white border transition-colors ${selectionMode ? "pt-10 pl-8" : ""}`}
                          style={{
                            backgroundColor: `hsl(${(idx * 12) % 360} 18% 14%)`,
                            borderColor: selectedSpaceItemIds.includes(item.id) ? themeColor : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {previewType === "image" && typeof previewValue === "string" && previewValue.startsWith("http") && (
                            <img src={previewValue} alt={item.title || ""} className="w-full max-h-48 object-contain rounded-[8px]" />
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
                              <video src={previewValue} className="w-full max-h-48 rounded-[8px] object-contain" controls preload="metadata" />
                            )
                          )}

                          {previewType === "pdf" && typeof previewValue === "string" && previewValue && (
                            <iframe
                              src={previewValue}
                              title={item.title || "PDF preview"}
                              className="w-full h-48 rounded-[8px] bg-white"
                            />
                          )}

                          {previewType === "link" && destination && (
                            isPdfUrl(destination) ? (
                              <iframe
                                src={destination}
                                title={item.title || "PDF preview"}
                                className="w-full h-48 rounded-[8px] bg-white"
                              />
                            ) : (
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
                                    } catch {}
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
                            )
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Items Dialog */}
      <Dialog open={addItemsDialogOpen} onOpenChange={setAddItemsDialogOpen}>
        <DialogContent
          className="w-[95vw] sm:w-[92vw] md:w-[88vw] lg:w-[70vw] max-w-3xl max-h-[82vh]
                     overflow-hidden flex flex-col rounded-2xl px-4 py-5 sm:px-6 sm:py-6"
        >
          <DialogHeader>
            <DialogTitle style={{ color: themeColor }}>Add Items to {space.name}</DialogTitle>
            <DialogDescription>
              Select items from your collection to add to this space
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items by title, content, type, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              style={{ borderColor: themeColor + "30" }}
            />
          </div>

          {loadingItems ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
            </div>
          ) : availableItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items available to add. All your items are already in this space!</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items match your search query</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="columns-1 sm:columns-2 md:columns-3" style={{ columnGap: '8px' }}>
                {filteredItems.map((item, idx) => {
                  const { type: previewType, value: previewValue, sourceUrl } = getPreviewData(item);
                  const destination = sourceUrl || (typeof previewValue === "string" ? previewValue : "");

                  return (
                  <div
                    key={item.id}
                    className="inline-block w-full mb-2 break-inside-avoid relative"
                    onClick={() => toggleAvailableItemSelection(item.id)}
                    style={{ breakInside: 'avoid' as any }}
                  >
                    {/* Checkbox overlay */}
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedAvailableItemIds.includes(item.id)}
                        onCheckedChange={() => toggleAvailableItemSelection(item.id)}
                        style={{ borderColor: themeColor }}
                      />
                    </div>
                    <div
                      className="rounded-[12px] p-3 pt-10 pl-8 mb-0 text-white cursor-pointer border"
                      style={{
                        backgroundColor: `hsl(${(idx * 12) % 360} 18% 14%)`,
                        borderColor: selectedAvailableItemIds.includes(item.id) ? themeColor : `${themeColor}30`,
                      }}
                    >
                      {previewType === "image" && typeof previewValue === "string" && previewValue.startsWith("http") && (
                        <img src={previewValue} alt={item.title || ""} className="w-full max-h-48 object-contain rounded-[8px]" />
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
                          <video src={previewValue} className="w-full max-h-48 rounded-[8px] object-contain" controls preload="metadata" />
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
                        isPdfUrl(destination) ? (
                          <iframe
                            src={destination}
                            title={item.title || "PDF preview"}
                            className="w-full h-48 rounded-[8px] bg-white"
                          />
                        ) : (
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
                                } catch {}
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
                        )
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
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedAvailableItemIds.length} item(s) selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAddItemsDialogOpen(false)}
                disabled={addingItems}
              >
                Cancel
              </Button>
              <Button
                style={{
                  backgroundColor: themeColor,
                  color: "white",
                }}
                className="hover:opacity-90"
                onClick={addItemsToSpace}
                disabled={addingItems || selectedAvailableItemIds.length === 0}
              >
                {addingItems ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${selectedAvailableItemIds.length} Item(s)`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Space</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{space.name}"? This will remove the space but keep all items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSpace}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Space"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item Detail Dialog */}
      <ItemDetailDialog
        item={selectedItem}
        open={itemDetailOpen}
        onOpenChange={setItemDetailOpen}
        onItemUpdated={loadSpaceDetails}
        onItemDeleted={loadSpaceDetails}
        contextSpaceId={space.id}
      />
    </DashboardLayout>
  );
};

export default SpaceDetail;
