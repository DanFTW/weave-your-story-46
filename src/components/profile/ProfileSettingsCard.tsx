import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ReactNode } from "react";

interface SettingsRowProps {
  icon: ReactNode;
  iconBgColor?: string;
  label: string;
  value?: string;
  hasChevron?: boolean;
  hasSwitch?: boolean;
  switchChecked?: boolean;
  onSwitchChange?: (checked: boolean) => void;
  onClick?: () => void;
  isLast?: boolean;
}

function SettingsRow({
  icon,
  iconBgColor = "bg-muted",
  label,
  value,
  hasChevron,
  hasSwitch,
  switchChecked,
  onSwitchChange,
  onClick,
  isLast,
}: SettingsRowProps) {
  const Component = hasSwitch ? 'div' : 'button';
  
  return (
    <Component
      onClick={hasSwitch ? undefined : onClick}
      className={`w-full flex items-center gap-3.5 py-3.5 px-1 ${!isLast ? 'border-b border-border/40' : ''} ${!hasSwitch ? 'cursor-pointer active:opacity-70' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <span className="text-[15px] font-semibold text-foreground flex-1 text-left">{label}</span>
      {value && (
        <span className="text-[15px] text-muted-foreground mr-1">{value}</span>
      )}
      {hasSwitch && (
        <Switch 
          checked={switchChecked} 
          onCheckedChange={onSwitchChange}
          className="data-[state=unchecked]:bg-muted"
        />
      )}
      {hasChevron && (
        <ChevronRight className="w-5 h-5 text-muted-foreground/70" />
      )}
    </Component>
  );
}

interface ProfileSettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function ProfileSettingsCard({ children, className = "" }: ProfileSettingsCardProps) {
  return (
    <div className={`bg-card rounded-[20px] px-4 shadow-sm border border-border/20 ${className}`}>
      {children}
    </div>
  );
}

export { SettingsRow };
