"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IlmHuntMark } from "@/components/icons/IlmHuntMark";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { NamesOfAllahBackdrop } from "@/components/layout/NamesOfAllahBackdrop";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Asking for a password reset link.
 *
 * `forgotPassword` has been translated into all six locales since long before
 * this page existed, and nothing rendered it: the label was there and the
 * route was not, so a player who forgot their password had no way back into
 * their account at all.
 *
 * The confirmation says the same thing whether or not the address has an
 * account. Telling a stranger which addresses are registered is an account
 * enumeration hole, and this app has one open signup form, so the answer would
 * be free to anyone who asked. Supabase itself does not distinguish the two
 * cases in its response either.
 */
export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Where the emailed link lands. Built from the live origin rather than a
      // configured base URL so the preview deployments send you back to the
      // preview you asked from, not to production.
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsSubmitting(false);

    // A rate limit is the one failure worth surfacing: it is the only one the
    // player can act on, by waiting. Anything else would leak whether the
    // address is registered.
    if (error && error.status === 429) {
      toast({
        variant: "destructive",
        title: t("couldntSendResetLink"),
        description: error.message,
      });
      return;
    }

    setSent(true);
  }

  return (
    <div dir={dir} className="relative flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <NamesOfAllahBackdrop />
      <div className="absolute top-4 start-4 z-20">
        <Button asChild variant="ghost" size="icon">
          <Link href="/login">
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
          <h1 className="mt-5 font-headline text-3xl font-bold">{t("resetTitle")}</h1>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-4 text-center">
                <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
                <h2 className="font-headline text-xl">{t("resetLinkSentTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("resetLinkSentBody")}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">{t("backToSignIn")}</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <p className="text-sm text-muted-foreground">{t("resetIntro")}</p>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || !email.trim()}>
                  {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("sendResetLink")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {!sent && (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {t("backToSignIn")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
