import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window (and the main content area) to the top whenever
 * the pathname changes. Place this inside <BrowserRouter>.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll the window itself
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    // Also scroll the main content area inside DashboardLayout (lg:ml-64)
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
