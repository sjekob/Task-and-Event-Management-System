/// Capitalizes names as the user types: the first letter of each word is
/// uppercased (e.g. "mark p. fuentes" → "Mark P. Fuentes"). The other letters
/// are left as typed so names like "McArthur", "John Paul II" or "dela Cruz"
/// (once corrected by the user) are not mangled.
///
/// Uppercases the first letter of each whitespace- or hyphen-separated word,
/// leaving the remaining letters unchanged.
export function titleCase(input: string): string {
  let out = '';
  let startOfWord = true;
  for (const ch of input) {
    if (ch === ' ' || ch === '\t' || ch === '-' || ch === '\n') {
      startOfWord = true;
      out += ch;
    } else {
      out += startOfWord ? ch.toUpperCase() : ch;
      startOfWord = false;
    }
  }
  return out;
}

/// FilteringTextInputFormatter.digitsOnly + LengthLimitingTextInputFormatter.
export const digitsOnly = (input: string, maxLength?: number): string => {
  const digits = input.replace(/[^0-9]/g, '');
  return maxLength != null ? digits.slice(0, maxLength) : digits;
};
