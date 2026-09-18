import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="font-display text-[44px] font-bold leading-none">404</h1>
        <p className="mt-3 text-base text-muted-foreground">
          This page doesn't exist. Check the address, or head back.
        </p>
        <Link to={user ? "/dashboard" : "/"} className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          {user ? "Go to the dashboard" : "Back to the home page"}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
