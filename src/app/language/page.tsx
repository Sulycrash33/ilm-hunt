"use client"

import { OnboardingBackdrop } from "@/components/layout/OnboardingBackdrop"
import { FlagIcon } from "@/components/icons/FlagIcons"
import Link from "next/link"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumCard } from "@/components/ui/premium-card"
import { motion } from "framer-motion"
import { useLanguage } from "@/contexts/LanguageContext"
import { saveOnboardingSelection } from "@/lib/onboarding-storage"
import type { Locale } from "@/lib/i18n"
import { SoundToggle } from "@/components/profile/SoundToggle"

const languages = [
  { name: "English", code: "en", flag: "gb", dir: "ltr" },
  { name: "Hausa", code: "ha", flag: "ng", dir: "ltr" },
  { name: "Français", code: "fr", flag: "fr", dir: "ltr" },
  { name: "العربية", code: "ar", flag: "sa", dir: "rtl", font: "'Amiri', serif" },
  { name: "Bahasa Melayu", code: "ms", flag: "my", dir: "ltr" },
  { name: "Bahasa Indonesia", code: "id", flag: "id", dir: "ltr" },
]

export default function LanguageSelectionPage() {
  const { setLocale, t } = useLanguage()

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4 py-6">
      {/* Sound is off by default, so the only way to turn it on was to find
          the profile — after onboarding has already started playing cues. */}
      <div className="absolute top-4 right-4 z-20">
        <SoundToggle compact />
      </div>
      <OnboardingBackdrop />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-5 sm:mb-8"
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary-container/20 flex items-center justify-center border-2 border-primary/30">
            <svg className="w-7 h-7 sm:w-10 sm:h-10 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
            </svg>
          </div>
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
            {t("welcome")}
          </h1>
          <p className="text-on-surface-variant">
            {t("chooseYourLanguage")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PremiumCard className="p-4 sm:p-6">
            <div className="space-y-2 sm:space-y-3">
              {languages.map((lang, index) => (
                <motion.div
                  key={lang.code}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Link
                    href="/intro"
                    onClick={() => {
                      setLocale(lang.code as Locale)
                      saveOnboardingSelection({ preferredLanguage: lang.code })
                    }}
                    dir={lang.dir}
                    className={`interactive-card flex min-h-16 items-center justify-between p-3 sm:p-4 rounded-xl border transition-colors hover:bg-surface-container-high hover:border-primary/30 ${
                      lang.font || ""
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <FlagIcon
                        code={lang.flag}
                        className="h-8 w-12 shrink-0 rounded-md"
                        aria-hidden="true"
                      />
                      <span className="font-bold text-on-surface text-lg">{lang.name}</span>
                    </div>
                    <svg
                      aria-hidden="true" className="w-5 h-5 text-on-surface-variant rtl:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </motion.div>
              ))}
            </div>
          </PremiumCard>
        </motion.div>

      </div>
    </div>
  )
}
