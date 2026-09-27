import re
from typing import Dict, Any, Optional

INDONESIAN_MONTHS = {
    "januari": "01", "jan": "01",
    "februari": "02", "feb": "02",
    "maret": "03", "mar": "03",
    "april": "04", "apr": "04",
    "mei": "05", "may": "05",
    "juni": "06", "jun": "06",
    "juli": "07", "jul": "07",
    "agustus": "08", "agu": "08", "agt": "08",
    "september": "09", "sep": "09",
    "oktober": "10", "okt": "10",
    "november": "11", "nov": "11",
    "desember": "12", "des": "12",
}

WORD_TO_DIGIT = {
    "nol": "0", "kosong": "0",
    "satu": "1", "dua": "2", "tiga": "3", "empat": "4",
    "lima": "5", "enam": "6", "tujuh": "7", "delapan": "8", "sembilan": "9"
}

class IndonesianEntityExtractor:
    @staticmethod
    def normalize_spoken_numbers(text: str) -> str:
        words = text.lower().split()
        normalized_words = []
        for w in words:
            normalized_words.append(WORD_TO_DIGIT.get(w, w))
        return " ".join(normalized_words)

    @classmethod
    def extract_fields(cls, text: str, theme_id: str = "clinic") -> Dict[str, str]:
        if not text or not text.strip():
            return {}

        extracted: Dict[str, str] = {}
        raw = text.strip()
        lower = raw.lower()
        num_normalized = cls.normalize_spoken_numbers(raw)

        # 1. No HP / WhatsApp (digits or spoken numbers)
        phone_match = re.search(r"(?:08|\+?628|\b8)[0-9\s-]{7,14}", num_normalized.replace(" ", ""))
        if phone_match:
            clean_phone = phone_match.group(0).replace(" ", "").replace("-", "")
            if len(clean_phone) >= 9:
                if clean_phone.startswith("8"):
                    clean_phone = "0" + clean_phone
                extracted["no_hp"] = clean_phone

        # 2. Tanggal Lahir (e.g. 12 Mei 1995, 12-05-1995)
        date_pattern = r"\b(\d{1,2})[\s/-]+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{1,2})[\s/-]+(\d{2,4})\b"
        date_match = re.search(date_pattern, lower)
        if date_match:
            day, month_str, year = date_match.groups()
            month = INDONESIAN_MONTHS.get(month_str, month_str.zfill(2))
            if len(year) == 2:
                year = "19" + year if int(year) > 40 else "20" + year
            extracted["tanggal_lahir"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # 3. Nama Lengkap / Nama Pelanggan
        name_match = re.search(r"(?:nama\s+lengkap\s+saya|nama\s+saya|panggil\s+saya|nama|saya)\s+([A-Za-z\s]{3,30})", raw, re.IGNORECASE)
        if name_match:
            candidate = name_match.group(1).strip()
            # Stop if encountering keywords
            candidate = re.split(r"\b(?:dan|lahir|keluhan|alamat|umur|tinggal|nomor|no|sakit)\b", candidate, flags=re.IGNORECASE)[0].strip()
            if len(candidate) >= 3 and not candidate.lower().startswith("mau"):
                field_key = "nama_lengkap" if theme_id == "clinic" else "nama_pelanggan"
                extracted[field_key] = candidate.title()

        # 4. Level Urgensi (rendah / sedang / tinggi)
        if any(w in lower for w in ["parah", "gawat", "darurat", "sangat sakit", "tinggi", "berat", "tidak tahan"]):
            extracted["level_urgensi"] = "tinggi"
        elif any(w in lower for w in ["sedang", "lumayan", "cukup", "agak sakit"]):
            extracted["level_urgensi"] = "sedang"
        elif any(w in lower for w in ["ringan", "rendah", "sedikit", "baru terasa", "biasa saja"]):
            extracted["level_urgensi"] = "rendah"

        # 5. Riwayat Alergi
        if any(w in lower for w in ["tidak ada alergi", "nggak ada alergi", "tidak punya alergi", "belum ada"]):
            extracted["riwayat_alergi"] = "Tidak ada"
        elif "alergi" in lower:
            allergy_match = re.search(r"alergi\s+([A-Za-z\s]{3,35})", raw, re.IGNORECASE)
            if allergy_match:
                extracted["riwayat_alergi"] = allergy_match.group(1).strip()

        # 6. Keluhan Utama / Detail Komplain
        if any(w in lower for w in ["sakit", "pusing", "demam", "batuk", "flu", "nyeri", "mual", "luka", "sesak", "masalah", "rusak", "komplain", "belum sampai"]):
            # Clean preamble
            clean_symptom = re.sub(r"^(?:saya|keluhan saya|keluhannya|saya merasa|merasa)\s+", "", raw, flags=re.IGNORECASE).strip()
            if len(clean_symptom) > 3:
                field_key = "keluhan_utama" if theme_id == "clinic" else "detail_komplain"
                extracted[field_key] = clean_symptom.capitalize()

        # 7. ID Transaksi (untuk form komplain)
        trx_match = re.search(r"(?:trx|order|pesanan|id|transaksi)[-:\s#]*([a-zA-Z0-9_-]{4,20})", raw, re.IGNORECASE)
        if trx_match:
            extracted["id_transaksi"] = trx_match.group(1).upper()

        # 8. Email Kontak
        email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", raw)
        if email_match:
            extracted["kontak_email"] = email_match.group(0).lower()

        # 9. Kategori Masalah (komplain)
        if any(w in lower for w in ["bayar", "transfer", "saldo", "rekening", "refund", "pembayaran"]):
            extracted["kategori_masalah"] = "pembayaran"
        elif any(w in lower for w in ["kirim", "kurir", "paket", "ekspedisi", "pengiriman"]):
            extracted["kategori_masalah"] = "pengiriman"
        elif any(w in lower for w in ["rusak", "cacat", "palsu", "kualitas", "pecah"]):
            extracted["kategori_masalah"] = "kualitas_produk"

        return extracted
