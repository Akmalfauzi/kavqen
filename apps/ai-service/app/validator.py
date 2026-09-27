import re
from typing import Dict, Any, Tuple

class FieldValidator:
    @staticmethod
    def validate_field(field_type: str, value: str, options: list = None) -> Tuple[bool, str]:
        if not value or not value.strip():
            return False, "Nilai tidak boleh kosong"

        val = value.strip()

        if field_type == "phone":
            # Simple phone format check
            digits = re.sub(r"\D", "", val)
            if len(digits) < 9:
                return False, "Nomor HP kurang valid (minimal 9 digit)"
            return True, digits

        elif field_type == "enum":
            if options and val.lower() not in [o.lower() for o in options]:
                return False, f"Pilihan harus salah satu dari: {', '.join(options)}"
            return True, val.lower()

        elif field_type == "boolean":
            normalized = val.lower()
            if normalized in ("true", "yes", "ya", "iya"):
                return True, "true"
            if normalized in ("false", "no", "tidak", "nggak", "enggak"):
                return True, "false"
            return False, "Jawaban harus Ya atau Tidak"

        elif field_type == "date":
            # Basic validation check
            return True, val

        return True, val
