-- ---------------------------------------------------------------------------
-- Finance RWA Isle — lưu tiến độ người chơi
--
-- Một dòng cho mỗi tài khoản. Toàn bộ tiến độ nằm trong một cột JSONB nên
-- schema không phải đổi mỗi lần game thêm tính năng.
--
-- Chạy: supabase db push  (hoặc dán vào SQL Editor trên dashboard)
-- ---------------------------------------------------------------------------

create table if not exists public.isle_saves (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  payload     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table public.isle_saves is
  'Tiến độ game của từng người dùng. Chỉ chứa dữ liệu do chính người dùng nhập: tên đảo, mục tiêu, nhiệm vụ, ghi chú, mốc tài sản tự khai.';

-- Chặn payload phình vô hạn (mặc định ~256KB là quá đủ cho một bản lưu).
alter table public.isle_saves
  drop constraint if exists isle_saves_payload_size;
alter table public.isle_saves
  add constraint isle_saves_payload_size check (pg_column_size(payload) < 262144);

alter table public.isle_saves enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: mỗi người chỉ đọc/ghi đúng dòng của mình. Không có policy nào cho phép
-- đọc chéo, kể cả khi client bị sửa — đây là chỗ thực thi quyền riêng tư.
-- ---------------------------------------------------------------------------

drop policy if exists "isle_saves_select_own" on public.isle_saves;
create policy "isle_saves_select_own"
  on public.isle_saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "isle_saves_insert_own" on public.isle_saves;
create policy "isle_saves_insert_own"
  on public.isle_saves for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "isle_saves_update_own" on public.isle_saves;
create policy "isle_saves_update_own"
  on public.isle_saves for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "isle_saves_delete_own" on public.isle_saves;
create policy "isle_saves_delete_own"
  on public.isle_saves for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at luôn do máy chủ đặt, client không thể khai gian thời điểm lưu.
-- ---------------------------------------------------------------------------

create or replace function public.isle_saves_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists isle_saves_touch on public.isle_saves;
create trigger isle_saves_touch
  before insert or update on public.isle_saves
  for each row execute function public.isle_saves_touch();
