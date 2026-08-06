import { useEffect, useState, type DragEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Link2, Image as ImageIcon, Video, Loader2, Check, UploadCloud } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded?: () => void;
}

type FileUploadTab = "image" | "video" | "article";

const isFileUploadTab = (value: string): value is FileUploadTab =>
  value === "image" || value === "video" || value === "article";

const formatFileSize = (size: number) => {
  if (!size || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, exponent);
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
};

export const AddItemDialog = ({ open, onOpenChange, onItemAdded }: AddItemDialogProps) => {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileUploadTab | null>(null);
  const [activeTab, setActiveTab] = useState<string>("note");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!file) {
      setProgress(0);
      return;
    }

    setProgress(12);
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 18;
        if (next >= 100) {
          window.clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 60);

    return () => window.clearInterval(interval);
  }, [file]);

  useEffect(() => {
    if (file && fileType === "image") {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    setPreviewUrl(null);
  }, [file, fileType]);

  useEffect(() => {
    if (!open) {
      setActiveTab("note");
      setFile(null);
      setFileType(null);
      setPreviewUrl(null);
      setProgress(0);
    }
  }, [open]);

  const handleTabChange = (value: string) => {
    if (value === activeTab) return;
    setActiveTab(value);
    setFile(null);
    setFileType(null);
    setPreviewUrl(null);
    setProgress(0);
  };

  const handleFileSelection = (files: FileList | null, targetType: FileUploadTab) => {
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    setProgress(0);
    setFile(selectedFile);
    setFileType(targetType);
  };

  const handleFileDrop = (event: DragEvent<HTMLLabelElement>, targetType: FileUploadTab) => {
    event.preventDefault();
    if (!event.dataTransfer?.files?.length) {
      return;
    }
    handleFileSelection(event.dataTransfer.files, targetType);
    event.dataTransfer.clearData();
  };

  const handleSubmit = async (type: string) => {
    const trimmedContent = content.trim();
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();
    const isUploadType = type === "image" || type === "video" || type === "article";

    if (isUploadType) {
      if (!file || fileType !== type) {
        toast({
          title: "Error",
          description: "Please choose a file to upload before submitting.",
          variant: "destructive",
        });
        return;
      }
    } else if (type === "note" && !trimmedContent) {
      toast({
        title: "Error",
        description: "Please write a note before submitting.",
        variant: "destructive",
      });
      return;
    } else if (type === "link" && !trimmedUrl && !trimmedContent) {
      toast({
        title: "Error",
        description: "Please provide a valid link before submitting.",
        variant: "destructive",
      });
      return;
    } else if (!isUploadType && !trimmedContent && !trimmedUrl) {
      toast({
        title: "Error",
        description: "Please provide some content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSuccessAnim(false);

    try {
      let response;

      if (isUploadType && file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        if (trimmedTitle) {
          formData.append("title", trimmedTitle);
        }

        const token = localStorage.getItem("access_token");
  const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/items/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.detail || "Failed to upload file");
        }

        response = await uploadResponse.json();
        setProgress(100);
      } else {
        const requestPayload = {
          type,
          content: type === "link" || type === "article" ? (trimmedUrl || trimmedContent) : trimmedContent,
          title: trimmedTitle || undefined,
        };

        response = await apiRequest("/api/v1/items/", "POST", requestPayload);
      }

      setSuccessAnim(true);
      toast({ title: "Success", description: "Item added successfully!" });

      setTimeout(() => {
        setContent("");
        setUrl("");
        setTitle("");
        setFile(null);
        setFileType(null);
        setPreviewUrl(null);
        setProgress(0);

        onOpenChange(false);
        setLoading(false);
        setSuccessAnim(false);
        if (onItemAdded) onItemAdded();
      }, 900);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add item",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-[680px] sm:w-auto max-h-[85vh] overflow-y-auto
                   fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                   overflow-hidden backdrop-blur-xl border border-white/15 bg-white/10 text-white font-sans leading-relaxed
                   px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 rounded-2xl
                   data-[state=open]:opacity-100 data-[state=open]:scale-100 opacity-0 scale-95 transition-all duration-300
                   before:absolute before:inset-0 before:pointer-events-none before:rounded-2xl 
                   before:bg-[radial-gradient(60%_60%_at_0%_0%,rgba(139,92,246,0.25),transparent_60%),radial-gradient(50%_60%_at_100%_100%,rgba(79,70,229,0.25),transparent_60%)]"
        style={{ fontFamily: 'Inter, "Space Grotesk", Satoshi, ui-sans-serif, system-ui, -apple-system' }}
      >
        {/* Local keyframes for the infinity loader and effects */}
        <style>
          {`
            @keyframes mf-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes mf-pulse-glow { 0%,100% { opacity: 1; } 50% { opacity: .7; } }
            @keyframes mf-particle { 0% { transform: translateY(0) scale(1); opacity: .3; } 50% { opacity: .8; } 100% { transform: translateY(-14px) scale(1.05); opacity: .2; } }
            @keyframes mf-pop { 0% { transform: scale(.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            .mf-spin { animation: mf-spin-slow 6s linear infinite; }
            .mf-pulse { animation: mf-pulse-glow 2.2s ease-in-out infinite; }
            .mf-pop { animation: mf-pop 320ms ease-out forwards; }
          `}
        </style>

        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-wide">Add New Item</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid h-auto w-full auto-rows-fr grid-cols-2 gap-2 rounded-xl bg-white/5 backdrop-blur ring-1 ring-white/10 p-1 sm:grid-cols-3 md:grid-cols-5">
              <TabsTrigger
                value="note"
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-all duration-300 outline-none sm:px-3 sm:text-sm
                         hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] hover:ring-1 hover:ring-violet-400/40
                         data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500/60 data-[state=active]:to-indigo-500/60 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-violet-400/60"
              >
                <FileText className="w-4 h-4 mr-1" />
                Note
              </TabsTrigger>
              <TabsTrigger
                value="link"
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-all duration-300 outline-none sm:px-3 sm:text-sm
                         hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] hover:ring-1 hover:ring-violet-400/40
                         data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500/60 data-[state=active]:to-indigo-500/60 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-violet-400/60"
              >
                <Link2 className="w-4 h-4 mr-1" />
                Link
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-all duration-300 outline-none sm:px-3 sm:text-sm
                         hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] hover:ring-1 hover:ring-violet-400/40
                         data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500/60 data-[state=active]:to-indigo-500/60 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-violet-400/60"
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                Image
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-all duration-300 outline-none sm:px-3 sm:text-sm
                         hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] hover:ring-1 hover:ring-violet-400/40
                         data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500/60 data-[state=active]:to-indigo-500/60 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-violet-400/60"
              >
                <Video className="w-4 h-4 mr-1" />
                Video
              </TabsTrigger>
              <TabsTrigger
                value="article"
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-all duration-300 outline-none sm:px-3 sm:text-sm
                         hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] hover:ring-1 hover:ring-violet-400/40
                         data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500/60 data-[state=active]:to-indigo-500/60 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-violet-400/60"
              >
                <FileText className="w-4 h-4 mr-1" />
                Article
              </TabsTrigger>
            </TabsList>

            <TabsContent value="note" className="space-y-4 transition-all duration-300 data-[state=inactive]:opacity-0 data-[state=inactive]:scale-95 data-[state=active]:opacity-100 data-[state=active]:scale-100">
              <div className="space-y-2">
                <Label htmlFor="note-content">Note Content</Label>
                <Textarea
                  id="note-content"
                  placeholder="Write your note here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none rounded-xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
              <Button
                onClick={() => handleSubmit("note")}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Note
              </Button>
            </TabsContent>

            <TabsContent value="link" className="space-y-4 transition-all duration-300 data-[state=inactive]:opacity-0 data-[state=inactive]:scale-95 data-[state=active]:opacity-100 data-[state=active]:scale-100">
              <div className="space-y-2">
                <Label htmlFor="link-url">Link URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="rounded-xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-title">Display name (optional)</Label>
                <Input
                  id="link-title"
                  type="text"
                  placeholder="e.g., My Article title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
              <Button
                onClick={() => handleSubmit("link")}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Link
              </Button>
            </TabsContent>

            <TabsContent value="image" className="space-y-4 transition-all duration-300 data-[state=inactive]:opacity-0 data-[state=inactive]:scale-95 data-[state=active]:opacity-100 data-[state=active]:scale-100">
              <div className="space-y-2">
                <Label htmlFor="image-file">Upload Image</Label>
                <div className="flex flex-col gap-4 md:flex-row">
                  <label
                    htmlFor="image-file"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleFileDrop(event, "image")}
                    className={`group relative flex h-40 sm:h-44 flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 sm:p-6 text-center transition hover:border-violet-400/60 hover:bg-white/10 ${file && fileType === "image" ? "border-violet-400/60 bg-white/10" : ""}`}
                  >
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleFileSelection(event.target.files, "image");
                        event.target.value = "";
                      }}
                    />
                    <div className="pointer-events-none flex flex-col items-center gap-2">
                      <UploadCloud className="h-9 w-9 text-violet-300 transition group-hover:-translate-y-0.5 group-hover:scale-105" />
                      <span className="text-sm font-medium text-white">Click to choose an image</span>
                      <span className="text-xs text-white/60">JPEG, PNG, SVG up to 10MB</span>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-2xl bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-500 ease-out"
                        style={{ width: file && fileType === "image" ? `${progress}%` : "0%" }}
                      />
                    </div>
                  </label>

                  {file && fileType === "image" && previewUrl ? (
                    <div className="flex w-full max-w-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="h-24 w-full rounded-xl object-cover"
                      />
                      <div className="space-y-1">
                        <p className="truncate text-sm font-medium text-white" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                onClick={() => handleSubmit("image")}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Image
              </Button>
            </TabsContent>

            <TabsContent value="video" className="space-y-4 transition-all duration-300 data-[state=inactive]:opacity-0 data-[state=inactive]:scale-95 data-[state=active]:opacity-100 data-[state=active]:scale-100">
              <div className="space-y-3">
                <Label htmlFor="video-file">Upload Video</Label>
                <label
                  htmlFor="video-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleFileDrop(event, "video")}
                  className={`group relative flex h-40 sm:h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 sm:p-6 text-center transition hover:border-violet-400/60 hover:bg-white/10 ${file && fileType === "video" ? "border-violet-400/60 bg-white/10" : ""}`}
                >
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => {
                      handleFileSelection(event.target.files, "video");
                      event.target.value = "";
                    }}
                  />
                  <div className="pointer-events-none flex flex-col items-center gap-2">
                    <UploadCloud className="h-9 w-9 text-violet-300 transition group-hover:-translate-y-0.5 group-hover:scale-105" />
                    <span className="text-sm font-medium text-white">Drag & drop or click to choose</span>
                    <span className="text-xs text-white/60">MP4, MOV, WEBM up to 50MB</span>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-2xl bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-500 ease-out"
                      style={{ width: file && fileType === "video" ? `${progress}%` : "0%" }}
                    />
                  </div>
                </label>

                {file && fileType === "video" ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                      <Video className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/50">Supports MP4, MOV, WEBM up to 500MB.</p>
                )}
              </div>
              <Button
                onClick={() => handleSubmit("video")}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Video
              </Button>
            </TabsContent>

            <TabsContent value="article" className="space-y-4 transition-all duration-300 data-[state=inactive]:opacity-0 data-[state=inactive]:scale-95 data-[state=active]:opacity-100 data-[state=active]:scale-100">
              <div className="space-y-3">
                <Label htmlFor="article-file">Upload PDF</Label>
                <label
                  htmlFor="article-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleFileDrop(event, "article")}
                  className={`group relative flex h-40 sm:h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 sm:p-6 text-center transition hover:border-violet-400/60 hover:bg-white/10 ${file && fileType === "article" ? "border-violet-400/60 bg-white/10" : ""}`}
                >
                  <Input
                    id="article-file"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      handleFileSelection(event.target.files, "article");
                      event.target.value = "";
                    }}
                  />
                  <div className="pointer-events-none flex flex-col items-center gap-2">
                    <UploadCloud className="h-9 w-9 text-violet-300 transition group-hover:-translate-y-0.5 group-hover:scale-105" />
                    <span className="text-sm font-medium text-white">Drop your PDF or click to browse</span>
                    <span className="text-xs text-white/60">PDF articles up to 25MB</span>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-2xl bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-500 ease-out"
                      style={{ width: file && fileType === "article" ? `${progress}%` : "0%" }}
                    />
                  </div>
                </label>

                {file && fileType === "article" ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/50">Attach research papers or PDFs up to 25MB.</p>
                )}
              </div>
              <Button
                onClick={() => handleSubmit("article")}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Article
              </Button>
            </TabsContent>
          </Tabs>
          {/* Loading overlay with infinity animation and success transition */}
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              {!successAnim ? (
                <div className="relative w-28 h-28">
                  {/* Halo */}
                  <div className="absolute inset-0 rounded-full blur-2xl opacity-50 mf-pulse"
                    style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.35), rgba(79,70,229,0.25), transparent)' }} />

                  {/* Infinity SVG */}
                  <svg className="relative w-28 h-28 mf-spin" viewBox="0 0 100 60" fill="none">
                    <defs>
                      <linearGradient id="mf-violet" x1="0" y1="0" x2="100" y2="60" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                      <linearGradient id="mf-cyan" x1="100" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <filter id="mf-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Violet trail */}
                    <path d="M10,30 C10,15 25,10 35,20 C45,30 55,30 65,20 C75,10 90,15 90,30 C90,45 75,50 65,40 C55,30 45,30 35,40 C25,50 10,45 10,30 Z"
                      stroke="url(#mf-violet)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                      filter="url(#mf-glow)" />
                    {/* Cyan trail (offset path for dual-glow effect) */}
                    <path d="M10,30 C12,17 27,12 36,21 C46,30 54,30 64,21 C74,12 88,17 90,30 C88,43 74,48 64,39 C54,30 46,30 36,39 C27,48 12,43 10,30 Z"
                      stroke="url(#mf-cyan)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"
                      opacity="0.9" />
                  </svg>

                  {/* Particles */}
                  <span className="absolute left-2 top-3 w-1.5 h-1.5 rounded-full bg-cyan-300/80 blur-[1px]" style={{ animation: 'mf-particle 1.8s ease-in-out infinite' }} />
                  <span className="absolute right-3 bottom-4 w-1.5 h-1.5 rounded-full bg-violet-300/80 blur-[1px]" style={{ animation: 'mf-particle 2.1s ease-in-out infinite .2s' }} />
                  <span className="absolute left-7 bottom-2 w-1 h-1 rounded-full bg-indigo-300/80 blur-[1px]" style={{ animation: 'mf-particle 2s ease-in-out infinite .4s' }} />
                  <span className="absolute right-8 top-1 w-1 h-1 rounded-full bg-sky-300/80 blur-[1px]" style={{ animation: 'mf-particle 2.3s ease-in-out infinite .1s' }} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 mf-pop">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-full blur-xl opacity-60" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.4), transparent)' }} />
                    <Check className="w-14 h-14 text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.65)]" />
                  </div>
                  <span className="text-sm text-emerald-300/90">Saved</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
