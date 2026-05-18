# notify-friend-spending

친구가 `transactions`에 새 소비를 추가했을 때, 친구 알림을 옵트인한
사람들에게 Web Push로 알린다. Supabase Database Webhook이 호출한다.

## 배포

```bash
# 1) Supabase CLI 로그인 + 프로젝트 link (한 번만)
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# 2) VAPID 시크릿 등록 (한 번만, 키는 `npx web-push generate-vapid-keys`로 생성)
supabase secrets set \
  VAPID_PUBLIC_KEY=<공개키> \
  VAPID_PRIVATE_KEY=<개인키> \
  VAPID_SUBJECT=mailto:lie9730@gmail.com

# 3) 함수 배포 (--no-verify-jwt: webhook은 JWT 없이 호출됨)
supabase functions deploy notify-friend-spending --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge Runtime이 자동 주입하므로
수동 설정 불필요.

## Database Webhook 등록 (Supabase Dashboard)

1. Supabase Dashboard → **Database → Webhooks** → **Create a new hook**
2. 다음 값으로 입력:
   - **Name**: `notify_friends_on_transaction`
   - **Table**: `public.transactions`
   - **Events**: ☑ Insert (Update/Delete는 체크하지 말 것 — soft delete가 알림 트리거하면 안 됨)
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: `notify-friend-spending`
   - **HTTP Method**: `POST`
   - **Headers**: 기본값 유지
   - **HTTP Params**: 비워둠
3. **Confirm**

## 동작 확인

1. 브라우저 A로 로그인 → `/settings` → 친구 알림 토글 on
2. 친구 코드로 브라우저 B와 페어링
3. 브라우저 B에서 `/dashboard` → 소비 추가
4. 브라우저 A에 알림 도착 확인 (Mac: 알림 센터, iOS: 잠금화면)
5. Edge Function 로그: Supabase Dashboard → **Edge Functions → notify-friend-spending → Logs**에서 `sent=N total=M` 형태 메시지 확인

## 트러블슈팅

- **알림 안 옴 + 로그에 `no subscriptions`**: 수신자 디바이스의 push 구독이
  등록되지 않음. `/settings`에서 토글 off → on 다시 해보고, 브라우저 알림 권한
  확인. iOS는 홈 화면에 설치된 PWA에서만 가능.
- **로그에 `web-push send failed` + statusCode 401/403**: VAPID 키 불일치.
  브라우저가 구독할 때 사용한 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`와 Edge Function이
  서명에 쓰는 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`가 다른 키 쌍이면 발생.
  같은 쌍으로 통일하고, 구독을 한 번 off → on 해서 새 endpoint 발급.
- **로그에 `vapid not configured`**: secrets 미설정. `supabase secrets list`로
  확인 후 재배포.
- **로그에 `skip soft-deleted`**: 정상. 삭제 트랜잭션은 알림 안 보냄.
- **친구 모두에게 알림이 가는 게 아니라 일부에게만**: 정상. 수신은 옵트인한
  친구만 받음 (`user_settings.friend_spending_notifications = true`).
