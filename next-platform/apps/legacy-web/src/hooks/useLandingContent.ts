import { useEffect, useState } from "react";
import {
  fetchLandingContent,
  type LandingContent,
  type LandingSlug,
} from "@/features/landing/repositories/landingContentRepository";

export type { LandingContent, LandingSlug };

export function useLandingContent(slug: LandingSlug = "consubov") {
  const [data, setData] = useState<LandingContent>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    void fetchLandingContent(slug).then((content) => {
      if (!mounted) return;
      setData(content);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [slug]);

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
