import { useEffect, useCallback } from "react";

/**
 * Hook that triggers a callback when the page becomes visible again.
 * Useful for refreshing data when users return to the tab.
 */
export const useVisibilityRefresh = (callback: () => void, enabled: boolean = true) => {
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible" && enabled) {
      callback();
    }
  }, [callback, enabled]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also handle window focus for additional reliability
    const handleFocus = () => {
      if (enabled) {
        callback();
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [handleVisibilityChange, callback, enabled]);
};
