import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Facebook, Pause, RefreshCw } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useFacebookPagePosts } from "@/hooks/useFacebookPagePosts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PagePostCard } from "./PagePostCard";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function FacebookPagePostsFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { isConnected, checkStatus } = useComposio('FACEBOOK');

  const {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling, syncedPosts,
    loadConfig, activateMonitoring, deactivateMonitoring, manualPoll,
  } = useFacebookPagePosts();

  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      await checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [checkStatus]);

  useEffect(() => {
    if (!isCheckingAuth && isConnected) {
      loadConfig();
    } else if (!isCheckingAuth && !isConnected) {
      sessionStorage.setItem('returnAfterFacebookConnect', '/flow/facebook-page-posts');
      navigate('/integration/facebook');
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate]);

  const handleBack = () => navigate('/threads');

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setPhase('activating');
      const success = await activateMonitoring();
      if (!success) setPhase('configure');
    } else {
      await deactivateMonitoring();
    }
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
      </div>
    );
  }

  if (phase === 'activating') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-[#1877F2] animate-spin mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activating monitoring...</h2>
            <p className="text-sm text-muted-foreground mt-1">Fetching your Facebook Page posts</p>
          </div>
        </div>
      </div>
    );
  }

  const getSubtitle = () => {
    switch (phase) {
      case 'configure': return 'Set up post tracking';
      case 'active': return 'Monitoring active';
      default: return 'Page post tracker';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.blue)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Facebook Page Posts</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-6">
        {/* Monitor Toggle Card */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                stats.isActive ? "bg-green-500/10" : "bg-muted/50"
              )}>
                {stats.isActive ? (
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <Facebook className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {stats.isActive ? 'Monitoring Active' : 'Enable Monitoring'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {stats.isActive && stats.lastPolledAt
                    ? `Last checked ${formatDistanceToNow(new Date(stats.lastPolledAt), { addSuffix: true })}`
                    : 'Track new posts from your Facebook Page'}
                </p>
              </div>
            </div>
            <Switch
              checked={stats.isActive}
              onCheckedChange={handleToggle}
              disabled={isActivating}
            />
          </div>

          {stats.isActive && (
            <div className="mt-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.postsSynced}</div>
                <div className="text-xs text-muted-foreground mt-1">Posts Synced</div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons when active */}
        {stats.isActive && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={manualPoll} disabled={isPolling} className="flex-1">
              <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
              {isPolling ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button variant="outline" onClick={() => deactivateMonitoring()} className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          </div>
        )}

        {/* Synced posts list */}
        {syncedPosts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Recent Posts ({syncedPosts.length})
            </h3>
            {syncedPosts.map(post => (
              <PagePostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
