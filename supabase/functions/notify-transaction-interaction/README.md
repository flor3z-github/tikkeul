# notify-transaction-interaction

친구가 내 거래에 이모지로 반응하거나 댓글을 남겼을 때, 알림을 옵트인한
거래 주인에게 Web Push로 알린다. `transaction_reactions` 또는
`transaction_comments` INSERT를 Supabase Database Webhook이 호출한다.

## 배포

```bash
# VAPID 시크릿은 notify-friend-spending과 동일하게 재사용 (이미 등록돼 있으면 스킵)
supabase functions deploy notify-transaction-interaction --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge Runtime이 자동 주입한다.

## Database Webhook 등록 (Supabase Dashboard)

두 개의 웹훅을 등록한다.

### 1) Reactions

- **Name**: `notify_owner_on_reaction`
- **Table**: `public.transaction_reactions`
- **Events**: ☑ Insert (Update/Delete는 체크하지 말 것)
- **Type**: `Supabase Edge Functions`
- **Edge Function**: `notify-transaction-interaction`
- **HTTP Method**: `POST`

### 2) Comments

- **Name**: `notify_owner_on_comment`
- **Table**: `public.transaction_comments`
- **Events**: ☑ Insert
- **Type**: `Supabase Edge Functions`
- **Edge Function**: `notify-transaction-interaction`
- **HTTP Method**: `POST`

## 동작 확인

1. 브라우저 A로 로그인 → `/settings` → 반응/댓글 알림 토글 on
2. 친구 코드로 브라우저 B와 페어링
3. 브라우저 B에서 `/dashboard?viewing=<A의 id>` → A의 거래에 이모지 반응 또는 댓글
4. 브라우저 A에 알림 도착 확인
5. Edge Function 로그에서 `sent=N total=M` 확인

## 동작 규칙

- 자기 자신이 자기 거래에 단 반응/댓글은 알림 생성 안 함 (`skip self`)
- `transaction_interaction_notifications=false`이면 `opted out`
- 같은 거래에 연속해서 반응/댓글이 달리면 `tx-interaction-<txId>` tag로 묶여
  알림이 합쳐진다 (브라우저/OS가 같은 tag 알림을 덮어쓰기 함)
