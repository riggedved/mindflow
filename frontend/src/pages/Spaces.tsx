import { useState, useEffect } from "react";
import { Plus, Sparkles, Folder, Lightbulb, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Space {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  item_count: number;
  is_suggested: boolean;
  created_at: string;
}

interface SpaceSuggestion {
  name: string;
  description: string;
  color: string;
  icon: string;
  item_ids: number[];
  item_count: number;
}

const iconMap: Record<string, any> = {
  Sparkles,
  Folder,
  Lightbulb,
};

const Spaces = () => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [suggestions, setSuggestions] = useState<SpaceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processingSuggestion, setProcessingSuggestion] = useState<{ name: string; action: "accept" | "reject" } | null>(null);
  const [newSpace, setNewSpace] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    icon: "Folder"
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/v1/spaces/");
      console.log("Spaces API response:", response);
      setSpaces(response.spaces || []);
    } catch (error: any) {
      console.error("Error loading spaces:", error);
      // Don't show error toast on initial load if it's just empty
      if (error.message && !error.message.includes("Session expired")) {
        toast({
          title: "Error",
          description: error.message || "Failed to load spaces",
          variant: "destructive",
        });
      }
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const response = await api.get("/api/v1/spaces/suggestions");
      console.log("Suggestions API response:", response);
      setSuggestions(response.suggestions || []);
      
      if ((response.suggestions || []).length === 0) {
        toast({
          title: "No suggestions",
          description: "You need at least 3 related items to get AI suggestions",
        });
      }
    } catch (error: any) {
      console.error("Error loading suggestions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load suggestions",
        variant: "destructive",
      });
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const createSpace = async () => {
    if (!newSpace.name.trim() || creating) {
      return;
    }

    try {
      setCreating(true);
      console.log("Creating space:", newSpace);
      await api.post("/api/v1/spaces/", newSpace);
      toast({
        title: "Success",
        description: "Space created successfully",
      });
      setCreateDialogOpen(false);
      setNewSpace({ name: "", description: "", color: "#6366f1", icon: "Folder" });
      loadSpaces();
    } catch (error: any) {
      console.error("Error creating space:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create space",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const acceptSuggestion = async (suggestion: SpaceSuggestion) => {
    try {
      setProcessingSuggestion({ name: suggestion.name, action: "accept" });
      console.log("Accepting suggestion:", suggestion);
      await api.post("/api/v1/spaces/suggestions/accept", {
        suggestion,
        item_ids: suggestion.item_ids
      });
      toast({
        title: "Success",
        description: `Space "${suggestion.name}" created with ${suggestion.item_count} items`,
      });
      setSuggestions(suggestions.filter(s => s.name !== suggestion.name));
      loadSpaces();
    } catch (error: any) {
      console.error("Error accepting suggestion:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept suggestion",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestion(null);
    }
  };

  const rejectSuggestion = async (suggestion: SpaceSuggestion) => {
    try {
      setProcessingSuggestion({ name: suggestion.name, action: "reject" });
      console.log("Rejecting suggestion:", suggestion);
      await api.post("/api/v1/spaces/suggestions/reject", {
        suggestion,
        item_ids: suggestion.item_ids
      });
      toast({
        title: "Suggestion rejected",
        description: "AI will be more conservative with future suggestions",
      });
      setSuggestions(suggestions.filter(s => s.name !== suggestion.name));
    } catch (error: any) {
      console.error("Error rejecting suggestion:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject suggestion",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestion(null);
    }
  };

  const deleteSpace = async () => {
    if (!spaceToDelete) return;
    
    try {
      setDeleting(true);
      await api.delete(`/api/v1/spaces/${spaceToDelete.id}`);
      toast({
        title: "Success",
        description: `Space "${spaceToDelete.name}" deleted successfully`,
      });
      setSpaces(spaces.filter(s => s.id !== spaceToDelete.id));
      setDeleteDialogOpen(false);
      setSpaceToDelete(null);
    } catch (error: any) {
      console.error("Error deleting space:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete space",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const viewSpace = (space: Space) => {
    navigate(`/spaces/${space.id}`);
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">Spaces</h1>
            <p className="text-muted-foreground max-w-2xl">
              AI-powered knowledge organization that learns from your patterns
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={loadSuggestions}
              disabled={suggestionsLoading}
              className="w-full sm:w-auto"
            >
              {suggestionsLoading ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 w-4 h-4" />
              )}
              AI Suggestions
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:opacity-90 w-full sm:w-auto">
                  <Plus className="mr-2 w-4 h-4" />
                  New Space
                </Button>
              </DialogTrigger>
              <DialogContent
                className="w-[95vw] sm:max-w-lg border border-white/10 bg-gray-900/60 text-white backdrop-blur-xl shadow-2xl rounded-2xl px-4 py-5 sm:px-6 sm:py-6"
                style={{
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px ${newSpace.color}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
                }}
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl tracking-tight">Create New Space</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Organize related items into a focused collection
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="name" className="text-white/80">Name</Label>
                    <Input
                      id="name"
                      value={newSpace.name}
                      onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                      placeholder="e.g., Design Inspiration"
                      className="mt-2 bg-white/5 border-white/10 text-white placeholder-white/40 focus-visible:ring-2"
                      style={{
                        boxShadow: `0 0 0 0 rgba(0,0,0,0)`,
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-white/80">Description</Label>
                    <Textarea
                      id="description"
                      value={newSpace.description}
                      onChange={(e) => setNewSpace({ ...newSpace, description: e.target.value })}
                      placeholder="What will you collect here?"
                      rows={3}
                      className="mt-2 bg-white/5 border-white/10 text-white placeholder-white/40 focus-visible:ring-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="color" className="text-white/80">Color</Label>
                    <div className="mt-2 flex items-center gap-3">
                      <Input
                        id="color"
                        type="color"
                        value={newSpace.color}
                        onChange={(e) => setNewSpace({ ...newSpace, color: e.target.value })}
                        className="h-10 w-10 rounded-full bg-white/10 border-white/10 p-2"
                        style={{ boxShadow: `0 0 20px ${newSpace.color}44` }}
                      />
                      <div
                        className="flex-1 h-10 rounded-md border border-white/10"
                        style={{
                          background: `linear-gradient(90deg, ${newSpace.color}22, transparent)`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 50px ${newSpace.color}22`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-white/20 text-white/80">
                    Cancel
                  </Button>
                  <Button
                    onClick={createSpace}
                    disabled={!newSpace.name.trim() || creating}
                    className="shadow-[0_10px_40px]"
                    style={{
                      background: `linear-gradient(135deg, ${newSpace.color}, ${newSpace.color}AA)`,
                      color: "white",
                      boxShadow: `0 10px 40px ${newSpace.color}55, 0 0 20px ${newSpace.color}44`,
                    }}
                  >
                    {creating ? (
                      <span className="inline-flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      "Create Space"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">AI Suggestions</h2>
              <Badge variant="secondary">{suggestions.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion, index) => {
                const Icon = iconMap[suggestion.icon] || Folder;
                const isAccepting =
                  processingSuggestion?.name === suggestion.name && processingSuggestion?.action === "accept";
                const isRejecting =
                  processingSuggestion?.name === suggestion.name && processingSuggestion?.action === "reject";
                const anyProcessing = Boolean(processingSuggestion);
                return (
                  <Card key={index} className="border-2 border-primary/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: suggestion.color + "20" }}
                          >
                            <Icon className="w-5 h-5" style={{ color: suggestion.color }} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">
                              {suggestion.item_count} items
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2">
                        {suggestion.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => acceptSuggestion(suggestion)}
                          disabled={anyProcessing}
                        >
                          {isAccepting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-1" />
                          )}
                          {isAccepting ? "Processing" : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => rejectSuggestion(suggestion)}
                          disabled={anyProcessing}
                        >
                          {isRejecting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-1" />
                          )}
                          {isRejecting ? "Processing" : "Reject"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No spaces yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first space or let AI suggest some based on your content
            </p>
            <Button onClick={loadSuggestions} disabled={suggestionsLoading}>
              <Sparkles className="mr-2 w-4 h-4" />
              Get AI Suggestions
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const Icon = iconMap[space.icon] || Folder;
              return (
                <Card 
                  key={space.id} 
                  className="group transition-all relative backdrop-blur-xl border hover:border-white/20"
                  style={{ 
                    background: `linear-gradient(135deg, ${space.color}1A, ${space.color}0D)`,
                    borderColor: `${space.color}33`,
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px ${space.color}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpaceToDelete(space);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="cursor-pointer" onClick={() => viewSpace(space)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"
                            style={{ backgroundColor: space.color + "25", boxShadow: `0 10px 30px ${space.color}55` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: space.color }} />
                          </div>
                          <div>
                            <CardTitle className="text-xl" style={{ color: space.color }}>
                              {space.name}
                            </CardTitle>
                            {space.is_suggested && (
                              <Badge 
                                variant="secondary" 
                                className="mt-1"
                                style={{ 
                                  backgroundColor: space.color + "20",
                                  color: space.color,
                                  borderColor: space.color + "40"
                                }}
                              >
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Created
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {space.description && (
                        <CardDescription className="mt-3" style={{ color: `${space.color}D0` }}>
                          {space.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: space.color,
                            color: space.color
                          }}
                        >
                          {space.item_count} {space.item_count === 1 ? 'item' : 'items'}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          style={{ color: space.color }}
                          className="hover:bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            viewSpace(space);
                          }}
                        >
                          View →
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                  {/* Glow overlay */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: `radial-gradient(600px circle at 0% 0%, ${space.color}55, transparent 40%)`,
                      filter: "blur(20px)",
                    }}
                  />
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Space Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Space</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{spaceToDelete?.name}"? This will remove the space but keep all items. This action cannot be undone.
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
      </div>
    </DashboardLayout>
  );
};

export default Spaces;
