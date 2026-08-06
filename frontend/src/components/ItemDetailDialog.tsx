import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Edit, Trash2, ExternalLink, Calendar, Tag, Plus, FolderPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
  ai_meta?: any;
  tags: string[];
  folder: string;
  created_at: string;
  spaceId?: number | null;
  space_id?: number | null;
}

interface ItemDetailDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemUpdated: () => void;
  onItemDeleted: () => void;
  contextSpaceId?: number | null;
}

export const ItemDetailDialog = ({
  item,
  open,
  onOpenChange,
  onItemUpdated,
  onItemDeleted,
  contextSpaceId = null,
}: ItemDetailDialogProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Item | null>(item);
  // Add to Space state
  const [addToSpaceOpen, setAddToSpaceOpen] = useState(false);
  const [spaces, setSpaces] = useState<Array<{ id: number; name: string; color?: string; icon?: string }>>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpace, setNewSpace] = useState({ name: "", description: "", color: "#6366f1", icon: "Folder" });
  const [addToSpaceSubmitting, setAddToSpaceSubmitting] = useState(false);
  const { toast } = useToast();

  // Update currentItem when item prop changes
  useEffect(() => {
    setCurrentItem(item);
    if (item) {
      setEditedTags(item.tags || []);
    }
  }, [item]);

  const assignedSpaceIds = useMemo(() => {
    const ids = new Set<number>();
    if (!currentItem) return ids;

    const direct = currentItem.spaceId ?? currentItem.space_id;
    if (typeof direct === "number") ids.add(direct);

    const maybeArrayIds = (currentItem as any)?.spaceIds ?? (currentItem as any)?.space_ids;
    if (Array.isArray(maybeArrayIds)) {
      for (const val of maybeArrayIds) {
        if (typeof val === "number") ids.add(val);
      }
    }

    const maybeSpaces = (currentItem as any)?.spaces;
    if (Array.isArray(maybeSpaces)) {
      for (const space of maybeSpaces) {
        const id = space?.id;
        if (typeof id === "number") ids.add(id);
      }
    }

    return ids;
  }, [currentItem]);

  // Load spaces when Add to Space dialog opens (keep hook before any early return)
  useEffect(() => {
    const loadSpaces = async () => {
      try {
        setSpacesLoading(true);
        const resp = await apiRequest("/api/v1/spaces/", "GET");
        const list = Array.isArray(resp?.spaces) ? resp.spaces : [];
        const filtered = list.filter((space: any) => !assignedSpaceIds.has(space.id));
        setSpaces(filtered);
        setSelectedSpaceId(filtered.length > 0 ? filtered[0].id : null);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load spaces", variant: "destructive" });
      } finally {
        setSpacesLoading(false);
      }
    };
    if (addToSpaceOpen) loadSpaces();
  }, [addToSpaceOpen, assignedSpaceIds, toast]);

  useEffect(() => {
    if (!addToSpaceOpen) {
      setShowCreateForm(false);
      setSelectedSpaceId(null);
    }
  }, [addToSpaceOpen]);

  if (!currentItem) return null;

  const assignedSpaceId = currentItem.spaceId ?? currentItem.space_id ?? null;
  const isInContextSpace = contextSpaceId != null && assignedSpaceId === contextSpaceId;

  const handleEdit = () => {
    setEditedDescription(currentItem.description || currentItem.title || "");
    setEditedTags(currentItem.tags || []);
    setIsEditing(true);
  };

  const addItemToSelectedSpace = async () => {
    if (!selectedSpaceId || !currentItem) return;
    try {
      setAddToSpaceSubmitting(true);
      await apiRequest(`/api/v1/spaces/${selectedSpaceId}/items`, "POST", { item_ids: [currentItem.id] });
      toast({ title: "Added", description: "Item added to space" });
      setAddToSpaceOpen(false);
  setCurrentItem((prev) => (prev ? { ...prev, spaceId: selectedSpaceId, space_id: selectedSpaceId } : prev));
      onItemUpdated();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to add to space", variant: "destructive" });
    } finally {
      setAddToSpaceSubmitting(false);
    }
  };

  const createSpaceAndAdd = async () => {
    if (!newSpace.name.trim() || !currentItem) return;
    try {
      setCreatingSpace(true);
      const created = await apiRequest("/api/v1/spaces/", "POST", newSpace);
      const newId = created?.id || created?.space?.id;
      if (!newId) {
        // fallback: reload spaces and pick the last
        const resp = await apiRequest("/api/v1/spaces/", "GET");
        const list = Array.isArray(resp?.spaces) ? resp.spaces : [];
        const last = list[list.length - 1];
        if (last?.id) {
          await apiRequest(`/api/v1/spaces/${last.id}/items`, "POST", { item_ids: [currentItem.id] });
          setCurrentItem((prev) => (prev ? { ...prev, spaceId: last.id, space_id: last.id } : prev));
        }
      } else {
        await apiRequest(`/api/v1/spaces/${newId}/items`, "POST", { item_ids: [currentItem.id] });
  setCurrentItem((prev) => (prev ? { ...prev, spaceId: newId, space_id: newId } : prev));
      }
      toast({ title: "Success", description: "Space created and item added" });
      setAddToSpaceOpen(false);
      onItemUpdated();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to create space", variant: "destructive" });
    } finally {
      setCreatingSpace(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        const updatedItem = await apiRequest(`/api/v1/items/${currentItem.id}/`, "PUT", {
          type: currentItem.type,
          content: currentItem.content, // required by backend Pydantic schema; preserve raw content
          description: editedDescription,
          tags: editedTags,
        });

        // Support APIs that wrap the result in { item: { ... } } or return the item directly
        const payload = (updatedItem && (updatedItem.item || updatedItem)) || {};

        // Update the current item with fresh data from server but DO NOT change raw content
        setCurrentItem({
          ...currentItem,
          description: payload.description || editedDescription,
          // keep original content (raw) — do not overwrite
          content: currentItem.content,
          tags: payload.tags || editedTags,
          folder: payload.folder || currentItem.folder,
        });
      
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setIsEditing(false);
      onItemUpdated(); // Refresh the list
    } catch (error: any) {
      // Normalize error message for toast (handle string, Error, response objects)
      let message = "Failed to update item";
      try {
        if (!error) {
          message = "Failed to update item";
        } else if (typeof error === "string") {
          message = error;
        } else if (error.message) {
          message = error.message;
        } else if (error.error) {
          message = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        } else {
          message = JSON.stringify(error);
        }
      } catch (e) {
        message = "Failed to update item";
      }

      console.error("Error saving item:", error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiRequest(`/api/v1/items/${currentItem.id}/`, "DELETE");
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onItemDeleted();
    } catch (error: any) {
      let message = "Failed to delete item";
      try {
        if (!error) {
          message = "Failed to delete item";
        } else if (typeof error === "string") {
          message = error;
        } else if (error.message) {
          message = error.message;
        } else if (error.error) {
          message = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        } else {
          message = JSON.stringify(error);
        }
      } catch (e) {
        message = "Failed to delete item";
      }
      console.error("Error deleting item:", error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-3 pr-0 sm:flex-row sm:items-center sm:justify-between sm:pr-8">
              <span className="capitalize text-lg font-semibold sm:text-xl">{currentItem.type}</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {!isEditing ? (
                  <>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={handleEdit}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive sm:w-auto"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                    {!isInContextSpace && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setAddToSpaceOpen(true)}
                      >
                        <FolderPlus className="w-4 h-4 mr-1" />
                        Add to Space
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Preview for Images/Videos/PDF (show raw media) */}
            {(currentItem.type === "image" || currentItem.type === "video" || currentItem.type === "article") && typeof currentItem.content === "string" && currentItem.content.startsWith("http") && (
              <div className="aspect-video w-full bg-secondary/50 rounded-lg overflow-hidden">
                {currentItem.type === "image" ? (
                  <img
                    src={currentItem.content}
                    alt={currentItem.description || currentItem.title}
                    className="w-full h-full object-contain"
                  />
                ) : currentItem.type === "video" ? (
                  <video
                    src={currentItem.content}
                    className="w-full h-full"
                    controls
                    controlsList="nodownload"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <iframe
                    src={currentItem.content}
                    className="w-full h-full"
                    title={currentItem.title || "PDF Preview"}
                  />
                )}
              </div>
            )}

            {/* Content block: always show the raw content (note text or link or image/video preview above) */}
            <div className="space-y-2">
              {currentItem.type === "link" ? (
                <a
                  href={currentItem.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  {/* Display AI-chosen title if available, fallback to description or raw URL */}
                  <span className="break-all">{currentItem.title || currentItem.description || currentItem.content}</span>
                </a>
              ) : currentItem.type === "article" ? (
                <div className="flex items-center gap-2">
                  <a
                    href={currentItem.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="break-all">{currentItem.title || currentItem.description || 'Open PDF'}</span>
                  </a>
                </div>
              ) : (currentItem.type === "image" || currentItem.type === "video") ? (
                // media preview shown above; no additional textual content
                null
              ) : (
                <p className="text-lg whitespace-pre-wrap">{currentItem.content}</p>
              )}
            </div>

            {/* Description (AI) - visible in detail view but NOT on dashboard */}
            {isEditing ? (
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={2}
                />
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="text-base whitespace-pre-wrap">{currentItem.description || currentItem.ai_meta?.description || ""}</p>
              </div>
            )}

            {/* Tags */}
            {!isEditing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="w-4 h-4" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(currentItem.tags || []).map((tag, idx) => (
                    <span
                      key={`${currentItem.id}-${tag}-${idx}`}
                      className="px-3 py-1 text-sm rounded-full bg-accent/20 text-accent border border-accent/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Tags */}
            {isEditing && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editedTags.map((tag, idx) => (
                    <span
                      key={`edit-${tag}-${idx}`}
                      className="px-3 py-1 text-sm rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTag}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Metadata */}
            {!isEditing && (
              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {new Date(currentItem.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📁</span>
                  <span>Folder: {currentItem.folder}</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Space Dialog */}
      <Dialog open={addToSpaceOpen} onOpenChange={setAddToSpaceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to Space</DialogTitle>
            <DialogDescription>
              Choose a space to add this item. If you don't have any spaces yet, create one or explore AI suggestions.
            </DialogDescription>
          </DialogHeader>

          {spacesLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading spaces…</div>
          ) : spaces.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {spaces.map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 rounded-md border hover:bg-secondary/40 cursor-pointer">
                  <input
                    type="radio"
                    name="space"
                    value={s.id}
                    checked={selectedSpaceId === s.id}
                    onChange={() => setSelectedSpaceId(s.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{s.name}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {assignedSpaceId
                  ? "This item is already assigned to its only available space. Create a new space to move it."
                  : "You don't have any spaces yet."}
              </div>
              {!showCreateForm ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Create Space
                  </Button>
                  <Button variant="outline" onClick={() => { setAddToSpaceOpen(false); navigate('/spaces'); }}>
                    Explore AI Suggestions
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="space-name">Name</Label>
                    <Input id="space-name" value={newSpace.name} onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="space-desc">Description</Label>
                    <Textarea id="space-desc" rows={2} value={newSpace.description} onChange={(e) => setNewSpace({ ...newSpace, description: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="space-color">Color</Label>
                    <Input id="space-color" type="color" value={newSpace.color} onChange={(e) => setNewSpace({ ...newSpace, color: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddToSpaceOpen(false)}>Close</Button>
            {spaces.length > 0 ? (
              <Button onClick={addItemToSelectedSpace} disabled={!selectedSpaceId || addToSpaceSubmitting}>
                {addToSpaceSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            ) : showCreateForm ? (
              <Button onClick={createSpaceAndAdd} disabled={!newSpace.name.trim() || creatingSpace}>
                {creatingSpace ? 'Creating…' : 'Create & Add'}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{currentItem.description || currentItem.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
