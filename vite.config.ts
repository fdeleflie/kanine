import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuration pour remplacer __dirname dans un environnement moderne (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Chargement des variables d'environnement (.env)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Configuration du serveur de développement local
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    
    // Plugins utilisés (React)
    plugins: [react()],
    
    // Chemin de base pour GitHub Pages (nom de ton dépôt)
    base: '/kanine/',
    
    // Injection des clés API pour qu'elles soient accessibles dans ton code
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // On double la sécurité avec API_KEY si ton code utilise ce nom
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    // Configuration des alias pour simplifier les imports (ex: import {X} from '@/components/Y')
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Optimisation du build pour GitHub Pages
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    }
  };
});
