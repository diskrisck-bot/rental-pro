import { createClient } from '@supabase/supabase-js';

// Tenta obter as variáveis do ambiente Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Só inicializa o client se tivermos os valores necessários para evitar o crash
// Caso contrário, exportamos um objeto que avisa sobre a falta de configuração
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as any, {
      get: () => {
        throw new Error("Supabase não configurado. Certifique-se de conectar a integração do Supabase e reiniciar o servidor.");
      }
    });

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas.");
}