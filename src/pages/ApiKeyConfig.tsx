import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Key, Shield, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useUserApiKeys } from '@/hooks/useUserApiKeys';
import { toast } from '@/hooks/use-toast';

export default function ApiKeyConfig() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { keys, isLoading, isSaving, saveKeys, hasKeys } = useUserApiKeys();
  
  const [apiKey, setApiKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showUserKey, setShowUserKey] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Populate form with existing keys
  useEffect(() => {
    if (keys) {
      setApiKey(keys.api_key || '');
      setPrivateKey(keys.private_key || '');
      setUserKey(keys.user_key || '');
    }
  }, [keys]);

  const validatePrivateKey = (key: string): boolean => {
    const trimmed = key.trim();
    return trimmed.includes('-----BEGIN') && trimmed.includes('-----END');
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !privateKey.trim() || !userKey.trim()) {
      toast({
        title: 'All fields required',
        description: 'Please fill in all API key fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!validatePrivateKey(privateKey)) {
      toast({
        title: 'Invalid private key',
        description: 'Private key must be in PEM format with BEGIN/END headers.',
        variant: 'destructive',
      });
      return;
    }

    const success = await saveKeys({
      api_key: apiKey.trim(),
      private_key: privateKey.trim(),
      user_key: userKey.trim(),
    });

    if (success) {
      toast({
        title: 'Keys saved',
        description: 'Your API keys have been securely stored.',
      });
      navigate('/profile');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -ml-2"
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">API Configuration</h1>
          {hasKeys && (
            <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" />
              Configured
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        className="px-5 py-6 space-y-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Info Card */}
        <div className="bg-card rounded-2xl p-4 border border-border/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Secure Storage</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your API keys are encrypted and stored securely. They are only used to authenticate your memory requests.
              </p>
            </div>
          </div>
        </div>

        {/* API Key Field */}
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            API Key
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="pr-10 h-12 rounded-xl bg-card border-border/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Private Key Field */}
        <div className="space-y-2">
          <Label htmlFor="privateKey" className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            Private Key
          </Label>
          <div className="relative">
            <Textarea
              id="privateKey"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              className={`min-h-[120px] rounded-xl bg-card border-border/50 font-mono text-xs resize-none ${
                showPrivateKey ? '' : 'text-security-disc'
              }`}
              style={!showPrivateKey ? { WebkitTextSecurity: 'disc' } as React.CSSProperties : undefined}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => setShowPrivateKey(!showPrivateKey)}
            >
              {showPrivateKey ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your full PEM-formatted private key including headers.
          </p>
        </div>

        {/* User Key Field */}
        <div className="space-y-2">
          <Label htmlFor="userKey" className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            User Key
          </Label>
          <div className="relative">
            <Input
              id="userKey"
              type={showUserKey ? 'text' : 'password'}
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              placeholder="Enter your user key"
              className="pr-10 h-12 rounded-xl bg-card border-border/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowUserKey(!showUserKey)}
            >
              {showUserKey ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !apiKey.trim() || !privateKey.trim() || !userKey.trim()}
          className="w-full h-14 rounded-full text-base font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save API Keys'
          )}
        </Button>
      </motion.div>
    </div>
  );
}