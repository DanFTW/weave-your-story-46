import { motion } from 'framer-motion';

export function MarqueeBanner() {
  const items = [...Array(20)].map((_, i) => (
    <span
      key={i}
      className="mx-8 text-sm font-medium tracking-wide whitespace-nowrap text-foreground/90"
    >
      Weave Corp Prototype · Fabric
    </span>
  ));

  return (
    <div className="w-full overflow-hidden bg-card/80 backdrop-blur-sm py-3 border-b border-border/50">
      <motion.div
        className="flex"
        animate={{ x: [0, -1920] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 30,
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
