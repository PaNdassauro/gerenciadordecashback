"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: LoginResult = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Travelback Manager</CardTitle>
          <p className="text-muted-foreground text-sm">
            Digite o codigo de acesso para entrar
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                name="code"
                placeholder="Codigo de acesso"
                autoComplete="off"
                autoFocus
                required
              />
              {state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
