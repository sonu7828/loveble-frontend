import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import https from "https";
import dns from "dns";
import { componentTagger } from "lovable-tagger";

const railwayAgent = new https.Agent({
  lookup: (hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    const opts = typeof options === "object" ? options : {};
    if (hostname.includes("railway.app")) {
      if (opts.all) {
        return cb(null, [{ address: "69.46.46.14", family: 4 }]);
      }
      return cb(null, "69.46.46.14", 4);
    }
    return dns.lookup(hostname, options, cb);
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "https://sonulovablebackend-production.up.railway.app",
        changeOrigin: true,
        secure: false,
        agent: railwayAgent,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
