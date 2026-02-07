import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: './', // <--- QUESTA È LA RIGA MAGICA
    plugins: [react()],
})
