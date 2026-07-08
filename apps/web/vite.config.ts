import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Local-only shell. No proxies, no remote anything. The strict CSP lives in
// index.html; production hardening (connect-src none) is tracked for Gate D.
export default defineConfig({
  plugins: [react()],
});
