import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSettingsCard, SettingsRow } from "@/components/profile/ProfileSettingsCard";
import { BellIcon, EyeIcon, SparkleIcon } from "@/components/profile/ProfileIcons";
import { SwipeToUnlock } from "@/components/profile/SwipeToUnlock";
import { ProfileEditDrawer } from "@/components/profile/ProfileEditDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserApiKeys } from "@/hooks/useUserApiKeys";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { hasKeys } = useUserApiKeys();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  
  // Use profile data with auth fallback
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || "Guest";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const handle = user?.email?.split('@')[0] || "guest";
  const mcpUrl = `mcp://liam.memory/user/${user?.id?.slice(0, 8) || 'guest'}`;

  const handleApiKeysClick = () => {
    navigate('/profile/api-keys');
  };

  const handleEditClick = () => {
    setEditDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header with blurred background */}
      <ProfileHeader 
        name={displayName}
        handle={handle}
        avatarUrl={avatarUrl}
        onEditClick={handleEditClick}
      />
      
      {/* Settings cards */}
      <div className="px-5 -mt-4 space-y-4 relative z-20">
        {/* API Configuration card */}
        <ProfileSettingsCard>
          <SettingsRow
            icon={<Key className="w-5 h-5 text-muted-foreground" />}
            iconBgColor="bg-muted"
            label="API Configuration"
            value={hasKeys ? "Configured" : "Not set"}
            hasChevron
            isLast
            onClick={handleApiKeysClick}
          />
        </ProfileSettingsCard>
        
        {/* Preferences card */}
        <ProfileSettingsCard>
          <SettingsRow
            icon={<BellIcon className="w-5 h-5 text-muted-foreground" />}
            iconBgColor="bg-muted"
            label="Notifications"
            hasSwitch
            switchChecked={notificationsEnabled}
            onSwitchChange={setNotificationsEnabled}
          />
          <SettingsRow
            icon={<EyeIcon className="w-5 h-5 text-muted-foreground" />}
            iconBgColor="bg-muted"
            label="Theme"
            value="Label title"
            hasChevron
            onClick={() => {}}
          />
          <SettingsRow
            icon={<SparkleIcon className="w-5 h-5 text-white" />}
            iconBgColor="bg-primary"
            label="App icon"
            value="Label title"
            hasChevron
            isLast
            onClick={() => {}}
          />
        </ProfileSettingsCard>

        {/* MCP URL Swipe to Unlock */}
        <SwipeToUnlock mcpUrl={mcpUrl} />
      </div>

      {/* Edit Profile Drawer */}
      <ProfileEditDrawer 
        open={editDrawerOpen} 
        onOpenChange={setEditDrawerOpen} 
      />
    </div>
  );
}
