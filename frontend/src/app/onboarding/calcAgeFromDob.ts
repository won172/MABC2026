// dob(yyyy-mm-dd) 문자열 → 오늘 기준 만 나이
export function calcAgeFromDob(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(dob + 'T00:00:00');
  if (isNaN(birth.getTime())) return 0;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
