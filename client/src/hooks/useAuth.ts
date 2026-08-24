import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { getToken, setToken, clearToken } from "@/lib/auth";

interface SessionResponse {
  authenticated: boolean;
}

const SESSION_QUERY_KEY = ["/api/auth/me"];

export function useSession() {
  return useQuery<SessionResponse | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!getToken(),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { passphrase: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: ({ token }) => {
      setToken(token);
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  return () => {
    clearToken();
    queryClient.clear();
    navigate("/login");
  };
}
