## Full Panel Rebuild Plan

### Phase 1: Database Schema
- Add `owner` to `app_role` enum (Owner > Admin > Reseller)
- Create `referral_codes` table (code, level, bonus_balance, acc_expiration, used_by, created_by)
- Create `features` table (name, enabled, app_name) — game mod feature toggles
- Create `mod_config` table (mod_name, status_text, master_switch)
- Update `handle_new_user` trigger for new role system
- Add RLS policies for all new tables

### Phase 2: Auth & Role System
- Rebuild Auth page (Login + Register)
- Owner: full control, can create Admins
- Admin: manage resellers, keys, pricing, feature toggles
- Reseller: generate keys using wallet balance

### Phase 3: Dashboard & Core Pages
- Owner Dashboard (all stats + admin management)
- Admin Dashboard (user/key/wallet stats)
- Reseller Dashboard (wallet, keys, referrals)
- User Management (owner can manage admins, admins manage resellers)
- Key Management (generate, edit, delete, reset, export)
- Pricing Management
- Wallet System (add balance requests with QR + screenshot)
- Transaction History
- Activity Logs

### Phase 4: New Features
- Referral Code Management (create codes, track usage, set bonus)
- Feature Toggle Management (ESP, AIM, etc. per game)
- Mod Config (mod name, status text, master on/off switch)

### Phase 5: Connect API (Edge Function)
- `/verify-license` — existing, enhance with feature flags
- `/connect` — new endpoint for game clients to fetch mod config, features, and verify license in one call
- `/referral/redeem` — API to redeem referral codes

### Phase 6: Responsive UI
- Fully mobile-responsive sidebar, tables, dialogs
- Branding (panel name + logo per reseller)
