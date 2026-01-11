import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSettingsCard, SettingsRow } from "@/components/profile/ProfileSettingsCard";
import { MailIcon, BellIcon, EyeIcon, SparkleIcon } from "@/components/profile/ProfileIcons";
import { SwipeToUnlock } from "@/components/profile/SwipeToUnlock";
import { useAuth } from "@/hooks/useAuth";
import { useUserApiKeys } from "@/hooks/useUserApiKeys";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasKeys } = useUserApiKeys();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // User data from auth
  const userData = {
    name: user?.user_metadata?.full_name || "User",
    handle: user?.email?.split('@')[0] || "user",
    email: user?.email || "Not set",
    avatarUrl: user?.user_metadata?.avatar_url,
    mcpUrl: `mcp://liam.memory/user/${user?.id?.slice(0, 8) || 'guest'}`,
  };

  const handleEmailClick = () => {
    navigate('/profile/api-keys');
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header with blurred background */}
      <ProfileHeader 
        name={userData.name}
        handle={userData.handle}
        avatarUrl={userData.avatarUrl}
      />
      
      {/* Settings cards */}
      <div className="px-5 -mt-4 space-y-4 relative z-20">
        {/* Email card - navigates to API key config */}
        <ProfileSettingsCard>
          <SettingsRow
            icon={<MailIcon className="w-5 h-5 text-muted-foreground" />}
            iconBgColor="bg-muted"
            label="API Configuration"
            value={hasKeys ? "Configured" : "Not set"}
            hasChevron
            isLast
            onClick={handleEmailClick}
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
        <SwipeToUnlock mcpUrl={userData.mcpUrl} />
      </div>
    </div>
  );
}
