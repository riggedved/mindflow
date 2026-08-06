import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { handleAuthCallback } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = () => {
      try {
        const authData = handleAuthCallback();
        
        if (authData) {
          // Successfully authenticated
          navigate("/dashboard", { replace: true });
        } else {
          // No auth data found, redirect to login
          navigate("/auth/login", { replace: true });
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/auth/login", { replace: true });
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
