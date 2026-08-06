import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api, apiEx } from "@/lib/api";
import { authStorage, logout } from "@/lib/auth";
import { downloadExtension, downloadLinkedExtension, showInstallationGuide } from "@/lib/extensionDownload";
import { LogOut, Save, ShieldCheck, Chrome, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Me = {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  created_at?: string | null;
};

const Settings = () => {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const initials = useMemo(() => {
    const n = (name || me?.name || me?.email || "").trim();
    if (!n) return "U";
    const parts = n.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }, [name, me]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await api.get("/api/v1/users/me");
        setMe(data);
        setName(data.name || "");
  setAvatar(data.avatar || "");
  setAvatarPreview("");
      } catch (e: any) {
        // Fallback to local storage if API not reachable
        const local = authStorage.getUser();
        if (local) {
          const fallback: Me = { ...local, created_at: null } as any;
          setMe(fallback);
          setName(fallback.name || "");
          setAvatar(fallback.avatar || "");
          setAvatarPreview("");
        }
      }
    };
    loadMe();

    // Check if extension is installed
    const checkExtension = () => {
      window.postMessage({ type: 'PING_EXTENSION' }, '*');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data.type === 'EXTENSION_ALIVE' || event.data.type === 'EXTENSION_INSTALLED') {
        setExtensionInstalled(true);
      }
    };

    window.addEventListener('message', handleMessage);
    checkExtension();
    const timeoutId = setTimeout(checkExtension, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, []);

  const joinedText = useMemo(() => {
    if (!me?.created_at) return "Member";
    try {
      const d = new Date(me.created_at);
      return `Member since ${d.toLocaleDateString()}`;
    } catch {
      return "Member";
    }
  }, [me?.created_at]);

  const onSave = async () => {
    if (!me) return;
    try {
      setSaving(true);
      let avatarUrl = avatar;
      // If a new file is selected, upload it first
      if (avatarFile) {
        const form = new FormData();
        form.append("file", avatarFile);
        const uploaded = await apiEx.upload("/api/v1/users/me/avatar", form);
        avatarUrl = uploaded.avatar || avatarUrl;
      }
      const updated = await api.patch("/api/v1/users/me", {
        name: name.trim(),
        avatar: avatarUrl || null,
      });
      setMe(updated);
      // Also refresh cached user
      authStorage.setUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatar: updated.avatar,
      });
      toast({ title: "Profile updated" });
      // Notify other components (e.g., DashboardLayout) to refresh user UI
      window.dispatchEvent(new CustomEvent("user-updated"));
      // Clear local preview/file after successful save
      setAvatar(updated.avatar || "");
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message || "Could not save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      // Best-effort server-side session clear
      await api.post("/api/v1/auth/logout");
    } catch {}
    // Always clear local session
    logout();
  };

  const handleDownloadExtension = () => {
    setExtensionModalOpen(true);
  };

  const handleInstallGuide = async () => {
    try {
      setDownloading(true);
      // Prefer linked download when the user is authenticated so the ZIP
      // includes an embedded device token. Fall back to plain download on error.
      try {
        if (authStorage.isAuthenticated()) {
          await downloadLinkedExtension();
        } else {
          await downloadExtension();
        }
      } catch (err) {
        console.warn('Linked download failed or not available, falling back:', err);
        await downloadExtension();
      }
      toast({
        title: "Extension Downloaded!",
        duration: 10000,
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Could not download extension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="text-muted-foreground max-w-2xl">Manage your profile, extension, and authentication preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Profile Overview */}
          <Card className="lg:col-span-2 bg-background/60 backdrop-blur-md rounded-2xl shadow-2xl border border-border/20">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center gap-3 md:w-64">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 ring-2 ring-transparent group-hover:ring-primary/30 transition">
                      {avatarPreview ? (
                        <AvatarImage src={avatarPreview} alt={name || me?.email} />
                      ) : avatar ? (
                        <AvatarImage src={avatar} alt={name || me?.email} />
                      ) : me?.avatar ? (
                        <AvatarImage src={me.avatar} alt={name || me?.email} />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    {/* Hover hint overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                      Change
                    </div>
                    {/* Invisible input over the avatar to open file chooser */}
                    <input
                      aria-label="Change profile image"
                      title="Change profile image"
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAvatarFile(file);
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setAvatarPreview(url);
                        } else {
                          setAvatarPreview("");
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">PNG, JPG, or GIF up to ~5MB</p>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Username</Label>
                      <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={me?.email || ""} disabled />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">{joinedText}</p>
                    <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Browser Extension Section */}
        <Card className="bg-background/60 backdrop-blur-md rounded-2xl shadow-2xl border border-border/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Chrome className="w-5 h-5 text-indigo-400" />
              Browser Extension
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium mb-1">MindFlow Capture Extension</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Save content from any webpage with a single right-click
                </p>
                <div className="flex items-center gap-2 mb-3">
                  {extensionInstalled ? (
                    <Badge variant="default" className="bg-green-600">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Installed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Installed</Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleDownloadExtension}
                className="flex-1 rounded-xl px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {extensionInstalled ? 'Reinstall Extension' : 'Install Extension'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Extension Installation Modal */}
        <Dialog open={extensionModalOpen} onOpenChange={setExtensionModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Chrome className="w-6 h-6 text-indigo-600" />
                MindFlow Browser Extension
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                Capture content from anywhere on the web with a single click
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Features */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm">
                    ✨
                  </div>
                  <div>
                    <p className="font-medium text-sm">Right-click to Save</p>
                    <p className="text-sm text-muted-foreground">
                      Save text, links, images, and videos instantly
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm">
                    🤖
                  </div>
                  <div>
                    <p className="font-medium text-sm">AI Auto-tagging</p>
                    <p className="text-sm text-muted-foreground">
                      Content is automatically organized with smart tags
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm">
                    🔍
                  </div>
                  <div>
                    <p className="font-medium text-sm">Seamless Integration</p>
                    <p className="text-sm text-muted-foreground">
                      Works with your MindFlow dashboard instantly
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <Button
                onClick={handleInstallGuide}
                disabled={downloading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "Downloading..." : "Download Extension"}
              </Button>

              {/* Installation Guide */}
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="font-medium text-sm">How to Install:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Download the extension zip file</li>
                  <li>Extract the ZIP file to a folder</li>
                  <li>Go to <code className="px-1 py-0.5 bg-background rounded text-xs">chrome://extensions/</code></li>
                  <li>Enable "Developer mode" (top right)</li>
                  <li>Click "Load unpacked" and select the extracted mindflow-extension folder</li>
                  <li>Use it anywhere on the web</li>
                </ol>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
