import React, { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: {
      retry: false,
    },
  });

  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      queryClient.clear();
      setLocation("/");
    }
  };

  useEffect(() => {
    if (!isLoading && !user && isError) {
      // Not authenticated
      const publicPaths = ["/", "/login", "/register", "/privacy", "/forgot-password", "/reset-password", "/verify-email"];
      if (!publicPaths.includes(location)) {
        setLocation("/login");
      }
    } else if (!isLoading && user) {
      // Authenticated
      if (
        location === "/login" ||
        location === "/register" ||
        location === "/"
      ) {
        if (!user.onboardingCompleted) {
          setLocation("/onboarding");
        } else {
          setLocation("/dashboard");
        }
      } else if (!user.onboardingCompleted && location !== "/onboarding") {
        setLocation("/onboarding");
      }
    }
  }, [user, isLoading, isError, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
