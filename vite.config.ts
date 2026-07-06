import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served from https://yasminenahla.github.io/Project-command/ — asset URLs
  // must be rooted at the repo path, not the domain root.
  base: '/Project-command/',
})
