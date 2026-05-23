import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="glass-elevated rounded-xl p-12 text-center max-w-md mx-4">
        <h1 className="mb-4 text-8xl font-light text-primary/20">404</h1>
        <p className="mb-2 text-xl font-medium">Page not found</p>
        <p className="mb-6 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-prism text-white rounded-full text-sm font-medium hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
          Return to Prism
        </a>
      </div>
    </div>
  );
};

export default NotFound;
