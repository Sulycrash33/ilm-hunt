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

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  useEffect(() => { setInviteCode(parseRoomCode(new URLSearchParams(window.location.search).get("room"))); }, []);
  const authPath = (path: string) => inviteCode ? `${path}?room=${inviteCode}` : path;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If the person came through onboarding (age -> avatar -> name), prefill
  // the name they already chose instead of asking again.
  useEffect(() => {
    const selections = getOnboardingSelections();
    if (selections.name) setUsername(selections.name);
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("passwordsDontMatch"),
        description: t("passwordsDontMatchDesc"),
      });
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: username },
      },
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("couldntCreateAccount"),
        description: error.message,
      });
      return;
    }

    // If email confirmation is required, Supabase returns a user but no
    // active session yet - send them to check their inbox instead of /home.
    if (data.user && !data.session) {
      toast({
        title: t("checkYourEmail"),
        description: t("checkYourEmailDesc"),
      });
      router.push(authPath("/login"));
      return;
    }

    // Apply the age/avatar chosen during onboarding to the real profile
    // row now that an account actually exists to attach it to.
    const selections = getOnboardingSelections();
    if (data.user && (selections.ageRange || selections.avatarUrl || selections.preferredLanguage)) {
      await supabase
        .from("profiles")
        .update({
          ...(selections.ageRange ? { age_range: selections.ageRange } : {}),
          ...(selections.avatarUrl ? { avatar_id: selections.avatarUrl } : {}),
          ...(selections.preferredLanguage ? { preferred_language: selections.preferredLanguage } : {}),
        })
        .eq("id", data.user.id);
    }
    clearOnboardingSelections();

    // Straight into the explainer, not the dashboard. A brand-new player has
    // no idea the game is a nine-tier ladder — the dashboard shows them a row
    // of padlocks and leaves them to work it out. The explainer marks itself
    // seen on arrival, so this is a one-time detour.
    router.push(inviteCode ? roomInvitePath(inviteCode) : "/onboarding/how-it-works");
    router.refresh();
  }

  return (
    <div dir={dir} className="relative flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <NamesOfAllahBackdrop />
      <div className="absolute top-4 start-4 z-20">
        <Button asChild variant="ghost" size="icon">
          <Link href={authPath("/login")}>
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
          <h1 className="mt-5 font-headline text-3xl font-bold">{t("createAccount")}</h1>
          <p className="mt-1 text-muted-foreground">{t("beginQuest")}</p>
          <div className="mt-4 flex items-center gap-2" aria-hidden="true">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/40" />
            <IlmHuntMark className="h-3 w-3 text-primary/50" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/40" />
          </div>
        </div>
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <Label htmlFor="username">{t("username")}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("yourNamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
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
                <Label htmlFor="password">{t("password")}</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createAccount")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyHaveAccount")}{" "}
          <Link href={authPath("/login")} className="font-semibold text-primary hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
