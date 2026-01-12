import { useState, useRef, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { toast } from "sonner";

interface ProfileEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDrawer({ open, onOpenChange }: ProfileEditDrawerProps) {
  const { profile, isSaving, updateProfile, uploadAvatar } = useProfile();
  const { createMemory } = useLiamMemory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [originalName, setOriginalName] = useState<string | null>(null);

  // Sync state when profile loads or drawer opens
  useEffect(() => {
    if (profile && open) {
      setFullName(profile.full_name || "");
      setAvatarUrl(profile.avatar_url);
      setOriginalName(profile.full_name);
    }
  }, [profile, open]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadAvatar(file);
    if (url) {
      setAvatarUrl(url);
    }
    setIsUploading(false);
    
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleSave = async () => {
    const updates: { full_name?: string; avatar_url?: string } = {};
    
    if (fullName !== profile?.full_name) {
      updates.full_name = fullName || undefined;
    }
    if (avatarUrl !== profile?.avatar_url) {
      updates.avatar_url = avatarUrl || undefined;
    }

    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }

    const success = await updateProfile(updates);
    
    if (success) {
      // If name was set/changed and it's different from original, create a memory
      if (updates.full_name && updates.full_name !== originalName) {
        try {
          await createMemory(`My name is ${updates.full_name}`, "identity");
        } catch (error) {
          console.error("Failed to create name memory:", error);
          // Don't block the save if memory creation fails
        }
      }
      
      toast.success("Profile updated");
      onOpenChange(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return "?";
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-8">
        <DrawerHeader className="px-0">
          <DrawerTitle className="text-center">Edit Profile</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-6 mt-4">
          {/* Avatar Upload */}
          <div className="relative">
            <button
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="relative group"
            >
              <Avatar className="w-28 h-28 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} alt="Profile" className="object-cover" />
                <AvatarFallback className="bg-muted text-2xl font-semibold text-muted-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Name Input */}
          <div className="w-full space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              This name will be used in your memories
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="w-full h-12 mt-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
