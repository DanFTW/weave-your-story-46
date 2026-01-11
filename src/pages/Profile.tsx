import { useState } from "react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSettingsCard, SettingsRow } from "@/components/profile/ProfileSettingsCard";
import { MailIcon, BellIcon, EyeIcon, SparkleIcon } from "@/components/profile/ProfileIcons";

export default function Profile() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Mock user data - replace with real data later
  const user = {
    name: "Mari Kondo",
    handle: "DoesItBringJoy",
    email: "jonapple@gmail.com",
    avatarUrl: undefined as string | undefined, // Set to undefined to show default gradient
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header with blurred background */}
      <ProfileHeader 
        name={user.name}
        handle={user.handle}
        avatarUrl={user.avatarUrl}
      />
      
      {/* Settings cards */}
      <div className="px-5 -mt-4 space-y-4 relative z-20">
        {/* Email card */}
        <ProfileSettingsCard>
          <SettingsRow
            icon={<MailIcon className="w-5 h-5 text-muted-foreground" />}
            iconBgColor="bg-muted"
            label="Email"
            value={user.email}
            hasChevron
            isLast
            onClick={() => {}}
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
      </div>
    </div>
  );
}
