export interface MoreExperienceCopy {
  reviewBackToQueue: string
  reviewRefresh: string
  reviewLoading: string
  reviewLoadFailed: string
  reviewQueueChanged: string
  reviewPace: string
  reviewFreshStart: string
  reviewQueueRemaining: string
  soloTimeRemaining: string
  copyRoomInvite: string
  roomInviteCopied: string
  roomInvited: string
  roomRestoring: string
  roomReconnecting: string
  roomRefreshFailed: string
  roomConnected: string

  battleKeyboardHint: string
  battleTimeUp: string
  battleChooseAnswer: string
  battleSpeedPoints: string
  battleWaitingHost: string
  battleSharedWin: string
  battleJointLeaders: string

  storeSearch: string
  inventoryCount: string
  copyRoomCode: string
  roomCodeCopied: string
  shopEmpty: string
  yourJourney: string
}

export const moreExperienceCopy: Record<"en" | "ha" | "fr" | "ar" | "ms" | "id", MoreExperienceCopy> = {
  "en": {
    "reviewBackToQueue": "Back to review",
    "reviewRefresh": "Refresh review queue",
    "reviewLoading": "Loading your review queue…",
    "reviewLoadFailed": "Your review queue could not load. Please try again.",
    "reviewQueueChanged": "Your review queue has changed. Refresh to see what is ready.",
    "reviewPace": "Learn at your pace. No timer, no lost lives.",
    "reviewFreshStart": "Explore a subject to keep learning. Your answered questions will return here when they are due.",
    "reviewQueueRemaining": "{count} more questions are due after this batch.",
    "soloTimeRemaining": "{count} seconds remaining",
    "copyRoomInvite": "Copy invitation link",
    "roomInviteCopied": "Invitation link copied",
    "roomInvited": "You were invited! Join the room below.",
    "roomRestoring": "Restoring your room…",
    "roomReconnecting": "Reconnecting to the room…",
    "roomRefreshFailed": "Room updates failed. Retry to catch up.",
    "roomConnected": "Room connected",
    "battleKeyboardHint": "Focus the question and press 1–4, or tap an answer.",
    "battleTimeUp": "Time is up for this question.",
    "battleChooseAnswer": "Choose your answer.",
    "battleSpeedPoints": "Speed points: +{count}",
    "battleWaitingHost": "Waiting for the host to continue…",
    "battleSharedWin": "Tied at {score} points. Ready for a rematch?",
    "battleJointLeaders": "Shared first place",

    "storeSearch": "Search the shop",
    "inventoryCount": "In your inventory: {count}",
    "copyRoomCode": "Copy room code",
    "roomCodeCopied": "Room code copied",
    "shopEmpty": "No items match. Try another search or category.",
    "yourJourney": "Your learning journey"
  },
  "ha": {
    "reviewBackToQueue": "Komawa sake dubawa",
    "reviewRefresh": "Sabunta jerin tambayoyin dubawa",
    "reviewLoading": "Ana loda tambayoyin dubawarka…",
    "reviewLoadFailed": "An kasa loda tambayoyin dubawarka. Sake gwadawa.",
    "reviewQueueChanged": "Jerin tambayoyin dubawarka ya canza. Sabunta don ganin abin da ya shirya.",
    "reviewPace": "Koyi a hankali yadda kake so. Babu ƙidayar lokaci ko rasa damar amsawa.",
    "reviewFreshStart": "Zaɓi fanni don ci gaba da koyo. Tambayoyin da ka amsa za su dawo nan lokacin dubawarsu.",
    "reviewQueueRemaining": "Akwai ƙarin tambayoyi {count} da za a duba bayan wannan rukuni.",
    "soloTimeRemaining": "Daƙiƙa {count} sun rage",
    "copyRoomInvite": "Kwafi hanyar gayyata",
    "roomInviteCopied": "An kwafi hanyar gayyata",
    "roomInvited": "An gayyace ka! Shiga ɗakin da ke ƙasa.",
    "roomRestoring": "Ana dawo da ɗakinka…",
    "roomReconnecting": "Ana sake haɗawa da ɗakin…",
    "roomRefreshFailed": "An kasa sabunta ɗaki. Sake gwadawa.",
    "roomConnected": "An haɗa ɗakin",
    "battleKeyboardHint": "Danna tambayar, sannan latsa 1–4 ko danna amsa.",
    "battleTimeUp": "Lokacin wannan tambayar ya ƙare.",
    "battleChooseAnswer": "Zaɓi amsarka.",
    "battleSpeedPoints": "Makin sauri: +{count}",
    "battleWaitingHost": "Ana jiran mai masaukin baki ya ci gaba…",
    "battleSharedWin": "An yi kunnen doki da maki {score}. Kuna son sake wasa?",
    "battleJointLeaders": "Matsayi na farko na haɗin gwiwa",

    "storeSearch": "Nemo kaya",
    "inventoryCount": "A cikin kayanka: {count}",
    "copyRoomCode": "Kwafi lambar ɗaki",
    "roomCodeCopied": "An kwafi lambar ɗaki",
    "shopEmpty": "Babu kayan da suka dace. Gwada wani bincike ko rukuni.",
    "yourJourney": "Tafiyarka ta ilimi"
  },
  "fr": {
    "reviewBackToQueue": "Retour aux révisions",
    "reviewRefresh": "Actualiser les révisions",
    "reviewLoading": "Chargement de vos révisions…",
    "reviewLoadFailed": "Impossible de charger vos révisions. Réessayez.",
    "reviewQueueChanged": "Vos révisions ont changé. Actualisez pour voir les questions disponibles.",
    "reviewPace": "Apprenez à votre rythme, sans chronomètre ni perte de vies.",
    "reviewFreshStart": "Explorez un sujet pour continuer à apprendre. Les questions auxquelles vous avez répondu reviendront ici au moment de les réviser.",
    "reviewQueueRemaining": "Encore {count} questions à réviser après cette série.",
    "soloTimeRemaining": "{count} secondes restantes",
    "copyRoomInvite": "Copier le lien d’invitation",
    "roomInviteCopied": "Lien d’invitation copié",
    "roomInvited": "Vous êtes invité ! Rejoignez la salle ci-dessous.",
    "roomRestoring": "Restauration de votre salle…",
    "roomReconnecting": "Reconnexion à la salle…",
    "roomRefreshFailed": "Actualisation impossible. Réessayez.",
    "roomConnected": "Salle connectée",
    "battleKeyboardHint": "Sélectionnez la question et appuyez sur 1–4, ou touchez une réponse.",
    "battleTimeUp": "Le temps est écoulé pour cette question.",
    "battleChooseAnswer": "Choisissez votre réponse.",
    "battleSpeedPoints": "Points de rapidité : +{count}",
    "battleWaitingHost": "En attente de l’hôte…",
    "battleSharedWin": "Égalité à {score} points. Une revanche ?",
    "battleJointLeaders": "Première place partagée",

    "storeSearch": "Rechercher dans la boutique",
    "inventoryCount": "Dans votre inventaire : {count}",
    "copyRoomCode": "Copier le code de la salle",
    "roomCodeCopied": "Code de la salle copié",
    "shopEmpty": "Aucun article correspondant. Essayez une autre recherche ou catégorie.",
    "yourJourney": "Votre parcours d’apprentissage"
  },
  "ar": {
    "reviewBackToQueue": "العودة إلى المراجعة",
    "reviewRefresh": "تحديث أسئلة المراجعة",
    "reviewLoading": "جارٍ تحميل أسئلة المراجعة…",
    "reviewLoadFailed": "تعذر تحميل أسئلة المراجعة. حاول مرة أخرى.",
    "reviewQueueChanged": "تغيرت أسئلة المراجعة. حدّث الصفحة لترى الأسئلة المتاحة.",
    "reviewPace": "تعلّم على مهلك، دون مؤقت أو خسارة محاولات.",
    "reviewFreshStart": "استكشف موضوعًا لتواصل التعلم. ستعود الأسئلة التي أجبت عنها هنا عند موعد مراجعتها.",
    "reviewQueueRemaining": "هناك {count} سؤالًا آخر للمراجعة بعد هذه المجموعة.",
    "soloTimeRemaining": "تبقى {count} ثانية",
    "copyRoomInvite": "انسخ رابط الدعوة",
    "roomInviteCopied": "تم نسخ رابط الدعوة",
    "roomInvited": "أنت مدعو! انضم إلى الغرفة أدناه.",
    "roomRestoring": "جارٍ استعادة غرفتك…",
    "roomReconnecting": "جارٍ إعادة الاتصال بالغرفة…",
    "roomRefreshFailed": "تعذر تحديث الغرفة. حاول مجدداً.",
    "roomConnected": "تم الاتصال بالغرفة",
    "battleKeyboardHint": "ركّز على السؤال واضغط 1–4، أو انقر على إجابة.",
    "battleTimeUp": "انتهى وقت هذا السؤال.",
    "battleChooseAnswer": "اختر إجابتك.",
    "battleSpeedPoints": "نقاط السرعة: +{count}",
    "battleWaitingHost": "بانتظار المضيف للمتابعة…",
    "battleSharedWin": "تعادل برصيد {score} نقطة. هل أنتم مستعدون لجولة أخرى؟",
    "battleJointLeaders": "المركز الأول المشترك",

    "storeSearch": "ابحث في المتجر",
    "inventoryCount": "في مخزونك: {count}",
    "copyRoomCode": "انسخ رمز الغرفة",
    "roomCodeCopied": "تم نسخ رمز الغرفة",
    "shopEmpty": "لا توجد عناصر مطابقة. جرّب بحثاً أو فئة أخرى.",
    "yourJourney": "رحلتك التعليمية"
  },
  "ms": {
    "reviewBackToQueue": "Kembali ke ulang kaji",
    "reviewRefresh": "Muat semula soalan ulang kaji",
    "reviewLoading": "Memuatkan soalan ulang kaji…",
    "reviewLoadFailed": "Soalan ulang kaji tidak dapat dimuatkan. Cuba lagi.",
    "reviewQueueChanged": "Soalan ulang kaji anda telah berubah. Muat semula untuk melihat soalan yang tersedia.",
    "reviewPace": "Belajar mengikut rentak anda, tanpa pemasa atau kehilangan nyawa.",
    "reviewFreshStart": "Terokai topik untuk terus belajar. Soalan yang telah dijawab akan kembali di sini apabila tiba masa untuk diulang kaji.",
    "reviewQueueRemaining": "{count} lagi soalan perlu diulang kaji selepas kumpulan ini.",
    "soloTimeRemaining": "Baki {count} saat",
    "copyRoomInvite": "Salin pautan jemputan",
    "roomInviteCopied": "Pautan jemputan disalin",
    "roomInvited": "Anda dijemput! Sertai bilik di bawah.",
    "roomRestoring": "Memulihkan bilik anda…",
    "roomReconnecting": "Menyambung semula ke bilik…",
    "roomRefreshFailed": "Kemas kini bilik gagal. Cuba lagi.",
    "roomConnected": "Bilik disambungkan",
    "battleKeyboardHint": "Fokus pada soalan dan tekan 1–4, atau ketik jawapan.",
    "battleTimeUp": "Masa untuk soalan ini telah tamat.",
    "battleChooseAnswer": "Pilih jawapan anda.",
    "battleSpeedPoints": "Mata kelajuan: +{count}",
    "battleWaitingHost": "Menunggu hos meneruskan…",
    "battleSharedWin": "Seri dengan {score} mata. Sedia untuk bermain semula?",
    "battleJointLeaders": "Tempat pertama bersama",

    "storeSearch": "Cari di kedai",
    "inventoryCount": "Dalam inventori anda: {count}",
    "copyRoomCode": "Salin kod bilik",
    "roomCodeCopied": "Kod bilik disalin",
    "shopEmpty": "Tiada item sepadan. Cuba carian atau kategori lain.",
    "yourJourney": "Perjalanan ilmu anda"
  },
  "id": {
    "reviewBackToQueue": "Kembali ke ulasan",
    "reviewRefresh": "Muat ulang soal ulasan",
    "reviewLoading": "Memuat soal ulasan…",
    "reviewLoadFailed": "Soal ulasan tidak dapat dimuat. Coba lagi.",
    "reviewQueueChanged": "Soal ulasan Anda telah berubah. Muat ulang untuk melihat soal yang tersedia.",
    "reviewPace": "Belajar sesuai ritme Anda, tanpa timer atau kehilangan nyawa.",
    "reviewFreshStart": "Jelajahi topik untuk terus belajar. Soal yang telah dijawab akan kembali di sini saat waktunya diulas.",
    "reviewQueueRemaining": "Masih ada {count} soal yang perlu diulas setelah kelompok ini.",
    "soloTimeRemaining": "Tersisa {count} detik",
    "copyRoomInvite": "Salin tautan undangan",
    "roomInviteCopied": "Tautan undangan disalin",
    "roomInvited": "Kamu diundang! Bergabung ke ruang di bawah.",
    "roomRestoring": "Memulihkan ruangmu…",
    "roomReconnecting": "Menyambungkan ulang ke ruang…",
    "roomRefreshFailed": "Pembaruan ruang gagal. Coba lagi.",
    "roomConnected": "Ruang tersambung",
    "battleKeyboardHint": "Fokus pada pertanyaan dan tekan 1–4, atau ketuk jawaban.",
    "battleTimeUp": "Waktu untuk pertanyaan ini habis.",
    "battleChooseAnswer": "Pilih jawabanmu.",
    "battleSpeedPoints": "Poin kecepatan: +{count}",
    "battleWaitingHost": "Menunggu tuan rumah melanjutkan…",
    "battleSharedWin": "Seri dengan {score} poin. Siap bermain lagi?",
    "battleJointLeaders": "Juara pertama bersama",

    "storeSearch": "Cari di toko",
    "inventoryCount": "Di inventarismu: {count}",
    "copyRoomCode": "Salin kode ruang",
    "roomCodeCopied": "Kode ruang disalin",
    "shopEmpty": "Tidak ada item yang cocok. Coba pencarian atau kategori lain.",
    "yourJourney": "Perjalanan belajarmu"
  }
}
