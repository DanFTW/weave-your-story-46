import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Apple, Mail } from 'lucide-react';
import { z } from 'zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email" }).max(255);
const passwordSchema = z.string().min(6, { message: "Password must be at least 6 characters" }).max(72);

interface AuthDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'signin' | 'signup';
}

export function AuthDrawer({ open, onOpenChange, mode }: AuthDrawerProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const { toast } = useToast();

  const isSignUp = mode === 'signup';
  const title = isSignUp ? 'Join Weave' : 'Sign In';

  const handleClose = () => {
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setErrors({});
    onOpenChange(false);
  };

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);
      
      if (error) {
        let message = error.message;
        
        // Friendly error messages
        if (message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please try again.';
        } else if (message.includes('User already registered')) {
          message = 'This email is already registered. Try signing in instead.';
        } else if (message.includes('Email not confirmed')) {
          message = 'Please check your email to confirm your account.';
        }
        
        toast({
          title: 'Authentication Error',
          description: message,
          variant: 'destructive',
        });
      } else if (isSignUp) {
        toast({
          title: 'Check your email',
          description: 'We sent you a confirmation link to complete your registration.',
        });
        handleClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign in with Google. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithApple();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign in with Apple. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-t border-border/50 max-h-[90vh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-2xl font-semibold text-foreground">{title}</DrawerTitle>
          <p className="text-sm text-muted-foreground mt-2 px-4">
            By continuing, you accept our{' '}
            <a href="#" className="text-foreground underline">Terms of use</a>. Please also our{' '}
            <a href="#" className="text-foreground underline">privacy policy</a> which defines how we use your personal information.
          </p>
        </DrawerHeader>

        <div className="px-6 pb-8 pt-4">
          <AnimatePresence mode="wait">
            {!showEmailForm ? (
              <motion.div
                key="options"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <Button
                  variant="outline"
                  className="w-full h-14 text-base font-medium rounded-full border-border/50 bg-card hover:bg-accent"
                  onClick={handleAppleSignIn}
                  disabled={isLoading}
                >
                  <Apple className="w-5 h-5 mr-3" />
                  {isSignUp ? 'Sign up with Apple' : 'Sign in with Apple'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-14 text-base font-medium rounded-full border-border/50 bg-card hover:bg-accent"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-14 text-base font-medium rounded-full border-border/50 bg-card hover:bg-accent"
                  onClick={() => setShowEmailForm(true)}
                  disabled={isLoading}
                >
                  <Mail className="w-5 h-5 mr-3" />
                  {isSignUp ? 'Sign up with Email' : 'Sign in with Email'}
                </Button>
              </motion.div>
            ) : (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleEmailSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-xl bg-accent/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-xl bg-accent/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : title}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  Back to options
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <button
            onClick={handleClose}
            className="w-full text-center text-lg font-medium text-destructive mt-6 hover:opacity-80 transition-opacity"
          >
            Cancel
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
