import { motion } from "framer-motion";

interface IntegrationGradientBackgroundProps {
  colors: {
    primary: string;
    secondary: string;
    tertiary?: string;
    quaternary?: string;
  };
}

export function IntegrationGradientBackground({ colors }: IntegrationGradientBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${colors.primary}40 0%, ${colors.secondary}30 50%, transparent 100%)`,
        }}
      />
      
      {/* Primary blur orb - top left, red/primary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute -top-20 -left-20 w-80 h-80 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.primary}90 0%, ${colors.primary}40 40%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Secondary blur orb - top right, blue/secondary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        className="absolute -top-10 -right-20 w-72 h-72 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.secondary}85 0%, ${colors.secondary}35 45%, transparent 70%)`,
          filter: "blur(35px)",
        }}
      />

      {/* Tertiary blur orb - center left, green/tertiary */}
      {colors.tertiary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="absolute top-24 -left-10 w-56 h-56 rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.tertiary}80 0%, ${colors.tertiary}30 50%, transparent 70%)`,
            filter: "blur(45px)",
          }}
        />
      )}

      {/* Quaternary blur orb - center right, yellow/quaternary */}
      {colors.quaternary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="absolute top-16 right-10 w-48 h-48 rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.quaternary}75 0%, ${colors.quaternary}25 50%, transparent 70%)`,
            filter: "blur(50px)",
          }}
        />
      )}

      {/* Subtle center blend orb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="absolute top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full"
        style={{
          background: `radial-gradient(circle, white 0%, transparent 60%)`,
          filter: "blur(60px)",
          opacity: 0.15,
        }}
      />
    </div>
  );
}
