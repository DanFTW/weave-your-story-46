import { motion } from 'framer-motion';

export function MarqueeBanner() {
  const items = [...Array(20)].map((_, i) => (
    <span
      key={i}
      className="flex items-center gap-6 mx-8 text-sm font-medium tracking-wide whitespace-nowrap text-foreground/90"
    >
      <span>Weave Corp Prototype</span>
      <span className="text-[2.5rem] leading-none -mt-1">·</span>
      <span>Fabric</span>
    </span>
  ));

  return (
    <div className="w-full overflow-hidden bg-card/80 backdrop-blur-sm py-4 border-b border-border/50">
      <motion.div
        className="flex"
        animate={{ x: [0, -1920] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 60,
            ease: "linear",
          },
        }}
      >
        {items}
        {items}
      </motion.div>
    </div>
  );
}
