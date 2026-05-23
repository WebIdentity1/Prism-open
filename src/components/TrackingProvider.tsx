import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { injectMetaPixel, injectGoogleAnalytics, trackMetaEvent, trackGAEvent } from "@/lib/tracking";

interface TrackingProviderProps {
  metaPixelId?: string | null;
  googleAnalyticsId?: string | null;
  children: React.ReactNode;
}

export function TrackingProvider({ metaPixelId, googleAnalyticsId, children }: TrackingProviderProps) {
  const location = useLocation();

  // Inject scripts on mount
  useEffect(() => {
    if (metaPixelId) injectMetaPixel(metaPixelId);
    if (googleAnalyticsId) injectGoogleAnalytics(googleAnalyticsId);
  }, [metaPixelId, googleAnalyticsId]);

  // Track page views on route change
  useEffect(() => {
    if (metaPixelId) trackMetaEvent("PageView");
    if (googleAnalyticsId) trackGAEvent("page_view", { page_path: location.pathname });
  }, [location.pathname, metaPixelId, googleAnalyticsId]);

  return <>{children}</>;
}
