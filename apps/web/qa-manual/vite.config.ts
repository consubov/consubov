import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const base=path.resolve(__dirname,"..");
export default defineConfig({
  plugins:[react()],root:base,envDir:false,
  optimizeDeps:{entries:["qa-manual/harness.html"]},
  resolve:{alias:[
    {find:"@/integrations/supabase/client",replacement:path.resolve(__dirname,"mockSupabase.ts")},
    {find:"@/hooks/useAuth",replacement:path.resolve(__dirname,"mockAuth.ts")},
    {find:"@/hooks/useNomeUsuario",replacement:path.resolve(__dirname,"mockNome.ts")},
    {find:"@/lib/pushService",replacement:path.resolve(__dirname,"mockPush.ts")},
    {find:"@/components/i18n/LocalizedText",replacement:path.resolve(__dirname,"mockLocalized.tsx")},
    {find:"sonner",replacement:path.resolve(__dirname,"mockSonner.ts")},
    {find:"@",replacement:path.resolve(base,"src")},
  ],dedupe:["react","react-dom","react/jsx-runtime","react/jsx-dev-runtime"]},
  server:{host:"127.0.0.1",port:18183,strictPort:true},
});
