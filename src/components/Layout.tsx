import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <BottomNav />
    </div>
  );
}
