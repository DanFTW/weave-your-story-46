import { motion } from 'framer-motion';

export function MarqueeBanner() {
  const items = [...Array(30)].map((_, i) => (
    <span
      key={i}
      className="flex items-center text-sm tracking-wide whitespace-nowrap text-foreground/90"
    >
      <span className="px-6 font-normal">Weave Corp Prototype</span>
      <span className="text-[2.5rem] leading-none -mt-1">·</span>
      <span className="px-6 font-bold uppercase">Fabric</span>
      <span className="text-[2.5rem] leading-none -mt-1">·</span>
    </span>
  ));

  return (
    <div className="w-full overflow-hidden bg-card/80 backdrop-blur-sm py-4 border-b border-border/50">
      <motion.div
        className="flex"
        animate={{ x: [0, -2880] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 120,
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
