export interface MoreExperienceCopy {
  storeSearch: string
  inventoryCount: string
  copyRoomCode: string
  roomCodeCopied: string
  shopEmpty: string
  yourJourney: string
}

export const moreExperienceCopy: Record<"en" | "ha" | "fr" | "ar" | "ms" | "id", MoreExperienceCopy> = {
  "en": {
    "storeSearch": "Search the shop",
    "inventoryCount": "In your inventory: {count}",
    "copyRoomCode": "Copy room code",
    "roomCodeCopied": "Room code copied",
    "shopEmpty": "No items match. Try another search or category.",
    "yourJourney": "Your learning journey"
  },
  "ha": {
    "storeSearch": "Nemo kaya",
    "inventoryCount": "A cikin kayanka: {count}",
    "copyRoomCode": "Kwafi lambar ɗaki",
    "roomCodeCopied": "An kwafi lambar ɗaki",
    "shopEmpty": "Babu kayan da suka dace. Gwada wani bincike ko rukuni.",
    "yourJourney": "Tafiyarka ta ilimi"
  },
  "fr": {
    "storeSearch": "Rechercher dans la boutique",
    "inventoryCount": "Dans votre inventaire : {count}",
    "copyRoomCode": "Copier le code de la salle",
    "roomCodeCopied": "Code de la salle copié",
    "shopEmpty": "Aucun article correspondant. Essayez une autre recherche ou catégorie.",
    "yourJourney": "Votre parcours d’apprentissage"
  },
  "ar": {
    "storeSearch": "ابحث في المتجر",
    "inventoryCount": "في مخزونك: {count}",
    "copyRoomCode": "انسخ رمز الغرفة",
    "roomCodeCopied": "تم نسخ رمز الغرفة",
    "shopEmpty": "لا توجد عناصر مطابقة. جرّب بحثاً أو فئة أخرى.",
    "yourJourney": "رحلتك التعليمية"
  },
  "ms": {
    "storeSearch": "Cari di kedai",
    "inventoryCount": "Dalam inventori anda: {count}",
    "copyRoomCode": "Salin kod bilik",
    "roomCodeCopied": "Kod bilik disalin",
    "shopEmpty": "Tiada item sepadan. Cuba carian atau kategori lain.",
    "yourJourney": "Perjalanan ilmu anda"
  },
  "id": {
    "storeSearch": "Cari di toko",
    "inventoryCount": "Di inventarismu: {count}",
    "copyRoomCode": "Salin kode ruang",
    "roomCodeCopied": "Kode ruang disalin",
    "shopEmpty": "Tidak ada item yang cocok. Coba pencarian atau kategori lain.",
    "yourJourney": "Perjalanan belajarmu"
  }
}
