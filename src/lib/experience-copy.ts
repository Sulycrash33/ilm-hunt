export interface ExperienceCopy {
  smallSteps: string
  journeyInvitation: string
  discoverSubjects: string
  searchSubjects: string
  allSubjects: string
  startedSubjects: string
  newSubjects: string
  noSubjectsFound: string
  clearSearch: string
  surpriseSubject: string
  exploreSubject: string
  moreWaysToGrow: string
  exploreMenuHint: string
  calmEffects: string
  calmEffectsHint: string
  checkingAnswer: string
  learningEncouragement: string
  successEncouragement: string
  shareProgress: string
  copyProgress: string
  shareProgressText: string
  progressCopied: string
  shareFailed: string
  onlyMistakes: string
  allAnswers: string
  playTogetherHint: string
  mainNavigation: string
}

export const experienceCopy: Record<"en" | "ha" | "fr" | "ar" | "ms" | "id", ExperienceCopy> = {
  en: {
    smallSteps: "Small steps. Lasting knowledge.",
    journeyInvitation: "Explore Islamic knowledge, find your rhythm, and celebrate what you learn.",
    discoverSubjects: "What will you discover today?",
    searchSubjects: "Search subjects",
    allSubjects: "All subjects",
    startedSubjects: "In progress",
    newSubjects: "Not started",
    noSubjectsFound: "No matching subjects. Try another word or filter.",
    clearSearch: "Clear search and filters",
    surpriseSubject: "Pick a subject for me",
    exploreSubject: "Explore subject",
    moreWaysToGrow: "More ways to grow",
    exploreMenuHint: "Find a new challenge, reconnect with friends, or revisit what you have learned.",
    calmEffects: "Reduce effects",
    calmEffectsHint: "Keep the experience calm with less movement and no confetti. Saved on this device.",
    checkingAnswer: "Checking your answer…",
    learningEncouragement: "Every attempt teaches you something. Review your answers and take your next step when you are ready.",
    successEncouragement: "You showed up, learned, and moved forward. Take a moment to enjoy your progress.",
    shareProgress: "Share progress", copyProgress: "Copy progress",
    shareProgressText: "I earned {xp} Barakah with {accuracy}% accuracy on Ilm Hunt. Join me at https://ilmhunt.app",
    progressCopied: "Progress copied. Share it wherever you like.",
    shareFailed: "Sharing is unavailable here. Try again in another browser.",
    onlyMistakes: "Review mistakes",
    allAnswers: "All answers",
    playTogetherHint: "Create a room or join friends for a shared challenge.",
    mainNavigation: "Main navigation",
  },
  ha: {
    smallSteps: "Ƙananan matakai. Ilimi mai ɗorewa.", journeyInvitation: "Bincika ilimin Musulunci, koyi a hankali, kuma yi farin ciki da abin da ka koya.",
    discoverSubjects: "Me za ka gano yau?", searchSubjects: "Nemo darussa", allSubjects: "Duk darussa", startedSubjects: "Ana ci gaba", newSubjects: "Ba a fara ba",
    noSubjectsFound: "Ba a sami darasi ba. Gwada wata kalma ko tacewa.", clearSearch: "Share bincike da tacewa", surpriseSubject: "Zaɓar mini darasi", exploreSubject: "Bincika darasi",
    moreWaysToGrow: "Ƙarin hanyoyin ci gaba", exploreMenuHint: "Nemo sabon ƙalubale, haɗu da abokai, ko sake duba abin da ka koya.",
    calmEffects: "Rage motsi", calmEffectsHint: "Rage motsi da confetti. Ana adana zaɓin a wannan na'urar.", checkingAnswer: "Ana duba amsarka…",
    learningEncouragement: "Kowace ƙoƙari tana koya maka wani abu. Duba amsoshinka sannan ka ci gaba idan ka shirya.", successEncouragement: "Ka koya kuma ka ci gaba. Ji daɗin nasararka.",
    shareProgress: "Raba ci gaba", copyProgress: "Kwafi ci gaba", shareProgressText: "Na samu Barakah {xp} da daidaiton {accuracy}% a Ilm Hunt. Haɗu da ni a https://ilmhunt.app",
    progressCopied: "An kwafi ci gaba. Raba shi inda kake so.", shareFailed: "Ba a iya rabawa a nan. Gwada wani burauza.", onlyMistakes: "Duba kurakurai", allAnswers: "Duk amsoshi",
    playTogetherHint: "Ƙirƙiri ɗaki ko shiga tare da abokai don ƙalubale.", mainNavigation: "Babban menu",
  },
  fr: {
    smallSteps: "Petits pas. Savoir durable.", journeyInvitation: "Explorez le savoir islamique, trouvez votre rythme et célébrez vos découvertes.",
    discoverSubjects: "Que découvrirez-vous aujourd’hui ?", searchSubjects: "Rechercher un sujet", allSubjects: "Tous les sujets", startedSubjects: "En cours", newSubjects: "À découvrir",
    noSubjectsFound: "Aucun sujet trouvé. Essayez un autre mot ou filtre.", clearSearch: "Effacer la recherche et les filtres", surpriseSubject: "Choisir un sujet pour moi", exploreSubject: "Explorer le sujet",
    moreWaysToGrow: "D’autres façons de progresser", exploreMenuHint: "Trouvez un défi, retrouvez vos amis ou révisez vos acquis.",
    calmEffects: "Réduire les effets", calmEffectsHint: "Moins de mouvement, sans confettis. Préférence enregistrée sur cet appareil.", checkingAnswer: "Vérification de votre réponse…",
    learningEncouragement: "Chaque tentative vous apprend quelque chose. Revoyez vos réponses et avancez à votre rythme.", successEncouragement: "Vous avez appris et progressé. Savourez ce moment.",
    shareProgress: "Partager mes progrès", copyProgress: "Copier mes progrès", shareProgressText: "J’ai gagné {xp} Barakah avec {accuracy}% de bonnes réponses sur Ilm Hunt. Rejoignez-moi sur https://ilmhunt.app",
    progressCopied: "Progrès copiés. Partagez-les où vous voulez.", shareFailed: "Le partage est indisponible ici. Essayez un autre navigateur.", onlyMistakes: "Revoir les erreurs", allAnswers: "Toutes les réponses",
    playTogetherHint: "Créez une salle ou rejoignez vos amis pour un défi commun.", mainNavigation: "Navigation principale",
  },
  ar: {
    smallSteps: "خطوات صغيرة. معرفة تدوم.", journeyInvitation: "اكتشف المعرفة الإسلامية، وتعلّم بإيقاعك، واحتفل بما تتعلّمه.",
    discoverSubjects: "ماذا ستكتشف اليوم؟", searchSubjects: "ابحث عن موضوع", allSubjects: "كل المواضيع", startedSubjects: "قيد التعلّم", newSubjects: "لم تبدأ بعد",
    noSubjectsFound: "لا توجد مواضيع مطابقة. جرّب كلمة أو تصفية أخرى.", clearSearch: "مسح البحث والتصفية", surpriseSubject: "اختر موضوعاً لي", exploreSubject: "استكشف الموضوع",
    moreWaysToGrow: "طرق أخرى للتقدّم", exploreMenuHint: "اكتشف تحدياً جديداً، أو انضم إلى الأصدقاء، أو راجع ما تعلّمته.",
    calmEffects: "تقليل المؤثرات", calmEffectsHint: "حركة أقل دون قصاصات احتفالية. يُحفظ اختيارك على هذا الجهاز.", checkingAnswer: "جارٍ التحقق من إجابتك…",
    learningEncouragement: "كل محاولة تعلّمك شيئاً. راجع إجاباتك وخذ خطوتك التالية حين تكون مستعداً.", successEncouragement: "تعلّمت وتقدّمت. استمتع بهذه اللحظة.",
    shareProgress: "شارك تقدّمك", copyProgress: "انسخ تقدّمك", shareProgressText: "حصلت على {xp} بركة بدقة {accuracy}% في Ilm Hunt. انضم إليّ عبر https://ilmhunt.app",
    progressCopied: "تم نسخ تقدّمك. شاركه حيث تشاء.", shareFailed: "المشاركة غير متاحة هنا. جرّب متصفحاً آخر.", onlyMistakes: "راجع الأخطاء", allAnswers: "كل الإجابات",
    playTogetherHint: "أنشئ غرفة أو انضم إلى أصدقائك في تحدٍّ مشترك.", mainNavigation: "التنقل الرئيسي",
  },
  ms: {
    smallSteps: "Langkah kecil. Ilmu berkekalan.", journeyInvitation: "Terokai ilmu Islam, belajar mengikut rentak anda dan raikan pengetahuan baharu.",
    discoverSubjects: "Apa yang akan anda temui hari ini?", searchSubjects: "Cari topik", allSubjects: "Semua topik", startedSubjects: "Sedang dipelajari", newSubjects: "Belum bermula",
    noSubjectsFound: "Tiada topik sepadan. Cuba perkataan atau penapis lain.", clearSearch: "Kosongkan carian dan penapis", surpriseSubject: "Pilih topik untuk saya", exploreSubject: "Terokai topik",
    moreWaysToGrow: "Lebih banyak cara untuk maju", exploreMenuHint: "Cari cabaran baharu, bersama rakan atau ulang kaji ilmu anda.",
    calmEffects: "Kurangkan kesan", calmEffectsHint: "Kurangkan pergerakan tanpa konfeti. Disimpan pada peranti ini.", checkingAnswer: "Menyemak jawapan anda…",
    learningEncouragement: "Setiap percubaan mengajar sesuatu. Semak jawapan dan teruskan apabila anda bersedia.", successEncouragement: "Anda telah belajar dan maju. Nikmati pencapaian ini.",
    shareProgress: "Kongsi kemajuan", copyProgress: "Salin kemajuan", shareProgressText: "Saya memperoleh {xp} Barakah dengan ketepatan {accuracy}% di Ilm Hunt. Sertai saya di https://ilmhunt.app",
    progressCopied: "Kemajuan disalin. Kongsikan di mana sahaja.", shareFailed: "Perkongsian tidak tersedia di sini. Cuba pelayar lain.", onlyMistakes: "Semak kesilapan", allAnswers: "Semua jawapan",
    playTogetherHint: "Cipta bilik atau sertai rakan untuk cabaran bersama.", mainNavigation: "Navigasi utama",
  },
  id: {
    smallSteps: "Langkah kecil. Ilmu yang bertahan.", journeyInvitation: "Jelajahi pengetahuan Islam, temukan ritmemu, dan rayakan yang kamu pelajari.",
    discoverSubjects: "Apa yang akan kamu temukan hari ini?", searchSubjects: "Cari topik", allSubjects: "Semua topik", startedSubjects: "Sedang dipelajari", newSubjects: "Belum dimulai",
    noSubjectsFound: "Tidak ada topik yang cocok. Coba kata atau filter lain.", clearSearch: "Hapus pencarian dan filter", surpriseSubject: "Pilihkan topik untuk saya", exploreSubject: "Jelajahi topik",
    moreWaysToGrow: "Lebih banyak cara untuk berkembang", exploreMenuHint: "Temukan tantangan baru, bermain bersama teman, atau ulas pengetahuanmu.",
    calmEffects: "Kurangi efek", calmEffectsHint: "Lebih sedikit gerakan tanpa konfeti. Tersimpan di perangkat ini.", checkingAnswer: "Memeriksa jawabanmu…",
    learningEncouragement: "Setiap percobaan mengajarkan sesuatu. Ulas jawaban dan lanjutkan saat kamu siap.", successEncouragement: "Kamu telah belajar dan berkembang. Nikmati kemajuanmu.",
    shareProgress: "Bagikan kemajuan", copyProgress: "Salin kemajuan", shareProgressText: "Saya memperoleh {xp} Barakah dengan akurasi {accuracy}% di Ilm Hunt. Bergabunglah di https://ilmhunt.app",
    progressCopied: "Kemajuan disalin. Bagikan di mana saja.", shareFailed: "Berbagi tidak tersedia di sini. Coba peramban lain.", onlyMistakes: "Ulas kesalahan", allAnswers: "Semua jawaban",
    playTogetherHint: "Buat ruang atau bergabung dengan teman untuk tantangan bersama.", mainNavigation: "Navigasi utama",
  },
}
