import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps non-investor routes. If the current user is an investor,
 * they are redirected to their investor dashboard.
 */
export default function InvestorGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role === "investor") {
    return <Navigate to="/investor" replace />;
  }
  return <>{children}</>;
}
