import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { useLogin, useSession } from "@/hooks/useAuth";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type LoginInput = { passphrase: string };

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const { data } = useSession();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { passphrase: "" },
  });

  useEffect(() => {
    if (getToken() && data?.authenticated) {
      navigate("/");
    }
  }, [data?.authenticated, navigate]);

  const onSubmit = (values: LoginInput) => {
    login.mutate(values, {
      onSuccess: () => navigate("/"),
      onError: () => {
        toast({ variant: "destructive", title: "Login failed", description: "Check your passphrase and try again." });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Rekindle</CardTitle>
          <CardDescription>Enter your passphrase to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="passphrase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passphrase</FormLabel>
                    <FormControl>
                      <Input type="password" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
