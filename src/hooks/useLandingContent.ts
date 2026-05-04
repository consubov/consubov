import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LandingContent = Record<string, string>;

export function useLandingContent() {
  const [data, setData] = useState<LandingContent>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("landing_page_content")
      .select("chave, valor")
      .then(({ data: rows }) => {
        if (!mounted) return;
        const map: LandingContent = {};
        (rows || []).forEach((r) => {
          map[r.chave] = r.valor || "";
        });
        setData(map);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Helper: get string with fallback
  const t = (key: string, fallback: string): string => {
    const v = data[key];
    return v && v.trim().length > 0 ? v : fallback;
  };

  // Helper: get JSON array with fallback
  function arr<T>(key: string, fallback: T[]): T[] {
    const raw = data[key];
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  return { data, loading, t, arr };
}
