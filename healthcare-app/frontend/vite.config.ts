import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path: GitHub Pages will serve at /Healthcare-EPIC-Snowflake-Demo/.
// Override with VITE_BASE=/ when previewing at root.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/Healthcare-EPIC-Snowflake-Demo/',
})
