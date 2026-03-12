import { Loader2, FileText } from "lucide-react";
import { motion } from "framer-motion";

export function GoogleDriveGeneratingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 thread-gradient-blue">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center"
      >
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>

        <div className="mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Extracting Memories</h1>
        <p className="text-white/80 text-base">
          Reading the document and identifying key facts...
        </p>
      </motion.div>
    </div>
  );
}
