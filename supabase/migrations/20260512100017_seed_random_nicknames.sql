-- 0017_seed_random_nicknames.sql
-- Auto-assign a random Korean nickname (adjective + noun + 4-digit number)
-- to new users when display_name is not provided. Backfill existing NULLs.
--
-- Pool stays loosely in sync with lib/utils/nickname.ts (TypeScript counterpart
-- used in app code). Drift is acceptable because nicknames are not exact;
-- only the format/length is contractual.

-- ---------------------------------------------------------------------------
-- Random nickname helper
-- ---------------------------------------------------------------------------
create or replace function public.random_nickname()
returns text
language plpgsql
as $$
declare
  adjectives constant text[] := array[
    '행복한','느긋한','용감한','수줍은','지혜로운','다정한','발랄한','조용한',
    '활기찬','꼼꼼한','따뜻한','시원한','달콤한','상큼한','포근한','신비한',
    '재빠른','단단한','부드러운','맑은','푸른','노란','빨간','초록',
    '귀여운','웃긴','똑똑한','성실한','자유로운','씩씩한','우아한','겸손한',
    '엉뚱한','상냥한','명랑한','진지한','부지런한','솔직한','대담한','침착한',
    '느슨한','반짝이는','달리는','춤추는','노래하는','꿈꾸는','떠도는','잠자는'
  ];
  nouns constant text[] := array[
    '오리','고양이','여우','너구리','강아지','다람쥐','토끼','사슴',
    '곰','늑대','수달','판다','펭귄','참새','앵무새','부엉이',
    '거북이','달팽이','문어','고래','돌고래','상어','잉어','금붕어',
    '나비','벌','개미','잠자리','반딧불이','매미','무당벌레','거미',
    '사자','호랑이','코끼리','기린','얼룩말','캥거루','코알라','하마',
    '독수리','까치','두루미','학','앵벌','참치','조랑말','양'
  ];
  adj text;
  noun text;
  digits text;
begin
  adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
  noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
  digits := lpad(floor(random() * 10000)::int::text, 4, '0');
  return adj || noun || digits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace handle_new_user: auto-fill display_name with random nickname.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  provided text;
begin
  provided := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(provided, public.random_nickname()))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Backfill existing NULL nicknames.
-- ---------------------------------------------------------------------------
update public.profiles
set display_name = public.random_nickname()
where display_name is null;
