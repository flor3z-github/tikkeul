// Random Korean nickname generator: {adjective}{noun}{4-digit}.
// Pool is loosely synced with the plpgsql counterpart in
// supabase/migrations/20260512100017_seed_random_nicknames.sql. Drift is
// acceptable because nicknames are not exact-matched; only format and length
// are contractual.

const ADJECTIVES = [
  "행복한", "느긋한", "용감한", "수줍은", "지혜로운", "다정한", "발랄한", "조용한",
  "활기찬", "꼼꼼한", "따뜻한", "시원한", "달콤한", "상큼한", "포근한", "신비한",
  "재빠른", "단단한", "부드러운", "맑은", "푸른", "노란", "빨간", "초록",
  "귀여운", "웃긴", "똑똑한", "성실한", "자유로운", "씩씩한", "우아한", "겸손한",
  "엉뚱한", "상냥한", "명랑한", "진지한", "부지런한", "솔직한", "대담한", "침착한",
  "느슨한", "반짝이는", "달리는", "춤추는", "노래하는", "꿈꾸는", "떠도는", "잠자는",
];

const NOUNS = [
  "오리", "고양이", "여우", "너구리", "강아지", "다람쥐", "토끼", "사슴",
  "곰", "늑대", "수달", "판다", "펭귄", "참새", "앵무새", "부엉이",
  "거북이", "달팽이", "문어", "고래", "돌고래", "상어", "잉어", "금붕어",
  "나비", "벌", "개미", "잠자리", "반딧불이", "매미", "무당벌레", "거미",
  "사자", "호랑이", "코끼리", "기린", "얼룩말", "캥거루", "코알라", "하마",
  "독수리", "까치", "두루미", "학", "앵벌", "참치", "조랑말", "양",
];

export const NICKNAME_MAX_LENGTH = 20;

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${adj}${noun}${digits}`;
}

export function isValidNickname(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LENGTH) return false;
  if (/[\r\n\t]/.test(trimmed)) return false;
  return true;
}
