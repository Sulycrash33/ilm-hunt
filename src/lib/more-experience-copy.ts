export interface MoreExperienceCopy {
  copyRoomInvite: string
  roomInviteCopied: string
  roomInvited: string
  roomRestoring: string
  roomReconnecting: string
  roomRefreshFailed: string
  roomConnected: string

  storeSearch: string
  inventoryCount: string
  copyRoomCode: string
  roomCodeCopied: string
  shopEmpty: string
  yourJourney: string
}

export const moreExperienceCopy: Record<"en" | "ha" | "fr" | "ar" | "ms" | "id", MoreExperienceCopy> = {
  "en": {
    "copyRoomInvite": "Copy invitation link",
    "roomInviteCopied": "Invitation link copied",
    "roomInvited": "You were invited! Join the room below.",
    "roomRestoring": "Restoring your room…",
    "roomReconnecting": "Reconnecting to the room…",
    "roomRefreshFailed": "Room updates failed. Retry to catch up.",
    "roomConnected": "Room connected",

    "storeSearch": "Search the shop",
    "inventoryCount": "In your inventory: {count}",
    "copyRoomCode": "Copy room code",
    "roomCodeCopied": "Room code copied",
    "shopEmpty": "No items match. Try another search or category.",
    "yourJourney": "Your learning journey"
  },
  "ha": {
    "copyRoomInvite": "Kwafi hanyar gayyata",
    "roomInviteCopied": "An kwafi hanyar gayyata",
    "roomInvited": "An gayyace ka! Shiga ɗakin da ke ƙasa.",
    "roomRestoring": "Ana dawo da ɗakinka…",
    "roomReconnecting": "Ana sake haɗawa da ɗakin…",
    "roomRefreshFailed": "An kasa sabunta ɗaki. Sake gwadawa.",
    "roomConnected": "An haɗa ɗakin",

    "storeSearch": "Nemo kaya",
    "inventoryCount": "A cikin kayanka: {count}",
    "copyRoomCode": "Kwafi lambar ɗaki",
    "roomCodeCopied": "An kwafi lambar ɗaki",
    "shopEmpty": "Babu kayan da suka dace. Gwada wani bincike ko rukuni.",
    "yourJourney": "Tafiyarka ta ilimi"
  },
  "fr": {
    "copyRoomInvite": "Copier le lien d’invitation",
    "roomInviteCopied": "Lien d’invitation copié",
    "roomInvited": "Vous êtes invité ! Rejoignez la salle ci-dessous.",
    "roomRestoring": "Restauration de votre salle…",
    "roomReconnecting": "Reconnexion à la salle…",
    "roomRefreshFailed": "Actualisation impossible. Réessayez.",
    "roomConnected": "Salle connectée",

    "storeSearch": "Rechercher dans la boutique",
    "inventoryCount": "Dans votre inventaire : {count}",
    "copyRoomCode": "Copier le code de la salle",
    "roomCodeCopied": "Code de la salle copié",
    "shopEmpty": "Aucun article correspondant. Essayez une autre recherche ou catégorie.",
    "yourJourney": "Votre parcours d’apprentissage"
  },
  "ar": {
    "copyRoomInvite": "انسخ رابط الدعوة",
    "roomInviteCopied": "تم نسخ رابط الدعوة",
    "roomInvited": "أنت مدعو! انضم إلى الغرفة أدناه.",
    "roomRestoring": "جارٍ استعادة غرفتك…",
    "roomReconnecting": "جارٍ إعادة الاتصال بالغرفة…",
    "roomRefreshFailed": "تعذر تحديث الغرفة. حاول مجدداً.",
    "roomConnected": "تم الاتصال بالغرفة",

    "storeSearch": "ابحث في المتجر",
    "inventoryCount": "في مخزونك: {count}",
    "copyRoomCode": "انسخ رمز الغرفة",
    "roomCodeCopied": "تم نسخ رمز الغرفة",
    "shopEmpty": "لا توجد عناصر مطابقة. جرّب بحثاً أو فئة أخرى.",
    "yourJourney": "رحلتك التعليمية"
  },
  "ms": {
    "copyRoomInvite": "Salin pautan jemputan",
    "roomInviteCopied": "Pautan jemputan disalin",
    "roomInvited": "Anda dijemput! Sertai bilik di bawah.",
    "roomRestoring": "Memulihkan bilik anda…",
    "roomReconnecting": "Menyambung semula ke bilik…",
    "roomRefreshFailed": "Kemas kini bilik gagal. Cuba lagi.",
    "roomConnected": "Bilik disambungkan",

    "storeSearch": "Cari di kedai",
    "inventoryCount": "Dalam inventori anda: {count}",
    "copyRoomCode": "Salin kod bilik",
    "roomCodeCopied": "Kod bilik disalin",
    "shopEmpty": "Tiada item sepadan. Cuba carian atau kategori lain.",
    "yourJourney": "Perjalanan ilmu anda"
  },
  "id": {
    "copyRoomInvite": "Salin tautan undangan",
    "roomInviteCopied": "Tautan undangan disalin",
    "roomInvited": "Kamu diundang! Bergabung ke ruang di bawah.",
    "roomRestoring": "Memulihkan ruangmu…",
    "roomReconnecting": "Menyambungkan ulang ke ruang…",
    "roomRefreshFailed": "Pembaruan ruang gagal. Coba lagi.",
    "roomConnected": "Ruang tersambung",

    "storeSearch": "Cari di toko",
    "inventoryCount": "Di inventarismu: {count}",
    "copyRoomCode": "Salin kode ruang",
    "roomCodeCopied": "Kode ruang disalin",
    "shopEmpty": "Tidak ada item yang cocok. Coba pencarian atau kategori lain.",
    "yourJourney": "Perjalanan belajarmu"
  }
}
