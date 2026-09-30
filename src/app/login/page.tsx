"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { IlmHuntMark } from "@/components/icons/IlmHuntMark";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NamesOfAllahBackdrop } from "@/components/layout/NamesOfAllahBackdrop";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { parseRoomCode, roomInvitePath } from "@/lib/multiplayer-experience";
import { getOnboardingSelections, clearOnboardingSelections } from "@/lib/onboarding-storage";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  useEffect(() => { setInviteCode(parseRoomCode(new URLSearchParams(window.location.search).get("room"))); }, []);
  const authPath = (path: string) => inviteCode ? `${path}?room=${inviteCode}` : path;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("couldntSignIn"),
        description: error.message,
      });
      return;
    }

    // Covers the case where signup required email confirmation: the
    // onboarding selections were still waiting in sessionStorage.
    const selections = getOnboardingSelections();
    if (data.user && (selections.ageRange || selections.avatarUrl)) {
      await supabase
        .from("profiles")
        .update({
          ...(selections.ageRange ? { age_range: selections.ageRange } : {}),
          ...(selections.avatarUrl ? { avatar_id: selections.avatarUrl } : {}),
        })
        .eq("id", data.user.id);
    }
    clearOnboardingSelections();

    router.push(roomInvitePath(inviteCode));
    router.refresh();
  }

  return (
    <div dir={dir} className="relative flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <NamesOfAllahBackdrop />
      <div className="absolute top-4 start-4 z-20">
        <Button asChild variant="ghost" size="icon">
          <Link href="/">
            <ArrowLeft className="h-6 w-6 rtl:rotate-180" />
            <span className="sr-only">{t("back")}</span>
          </Link>
        </Button>
      </div>
      <div className="z-10 w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-20 items-end justify-center overflow-hidden rounded-t-full border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent">
            <div className="absolute inset-x-0 top-0 flex h-full items-center justify-center">
              <IlmHuntMark className="h-10 w-10 text-primary" />
            </div>
            <div className="mb-2 h-px w-8 bg-primary/40" />
          </div>
          <h1 className="mt-5 font-headline text-3xl font-bold">{t("welcomeBack")}</h1>
          <p className="mt-1 text-muted-foreground">{t("signInToContinue")}</p>
          <div className="mt-4 flex items-center gap-2" aria-hidden="true">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/40" />
            <IlmHuntMark className="h-3 w-3 text-primary/50" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/40" />
          </div>
        </div>
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@ilmhunt.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  {/* The one way back in for someone who cannot sign in. The
                      label has been translated into all six locales since long
                      before the route existed, and nothing rendered it. */}
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("signIn")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          {t("dontHaveAccount")}{" "}
          <Link href={authPath("/signup")} className="font-semibold text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
