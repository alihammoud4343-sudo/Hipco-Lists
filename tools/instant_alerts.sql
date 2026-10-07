-- HIPCO instant alerts: every event in the app pushes a notification to every phone, within seconds.
-- Paste into Supabase > SQL Editor > Run. Replace PASTE_ONESIGNAL_REST_API_KEY first (OneSignal > Settings > Keys & IDs).
create extension if not exists pg_net with schema extensions;

create or replace function public.hipco_push(t text, b text) returns void
language plpgsql security definer as $f$
begin
  perform net.http_post(
    url := 'https://api.onesignal.com/notifications?c=push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Key PASTE_ONESIGNAL_REST_API_KEY'),
    body := jsonb_build_object('app_id','9722a093-2b4b-4002-a1d8-bc4910456d78','target_channel','push',
      'included_segments', jsonb_build_array('Total Subscriptions'),
      'headings', jsonb_build_object('en', t), 'contents', jsonb_build_object('en', b),
      'url','https://alihammoud4343-sudo.github.io/Hipco-Lists/'));
end $f$;

create or replace function public.hipco_kv_alert() returns trigger
language plpgsql security definer as $f$
declare d jsonb := new.data; o jsonb := case when tg_op='UPDATE' then old.data else null end;
        sm text := coalesce(d->>'salesman',''); cl text := coalesce(d->>'client',''); st text := coalesce(d->>'status','');
        ost text := coalesce(o->>'status',''); rf text := upper(regexp_replace(new.id,'^(sl)-?(\d+).*$','\1\2','i'));
        lbl text;
begin
  if new.col = 'inquiries' then
    if tg_op='INSERT' then perform hipco_push('New inquiry '||coalesce('INQ-'||lpad(regexp_replace(coalesce(d->>'no',''),'\D','','g'),3,'0'),''), sm||': '||cl||' · '||coalesce(d->>'product','')||coalesce(' · '||(d->>'qty'),''));
    elsif st <> ost then
      lbl := case st when 'open' then 'Still pending' when 'supplier' then 'Sent to supplier' when 'price' then 'Price sent to client' when 'neg' then 'Negotiating' when 'won' then 'Order confirmed' when 'lost' then 'Lost' when 'cancel' then 'Cancelled / no stock' else st end;
      perform hipco_push('Inquiry update', cl||' ('||sm||'): '||lbl);
    end if;
  elsif new.col = 'reminders' then
    if tg_op='INSERT' then perform hipco_push('New reminder', sm||': '||cl||coalesce(' — '||(d->>'note'),''));
    elsif st <> ost and st = 'done' then perform hipco_push('Reminder done', sm||' marked done: '||cl||coalesce(' — '||(d->>'note'),''));
    elsif st <> ost then perform hipco_push('Reminder update', sm||': '||cl||' → '||st);
    end if;
  elsif new.col = 'sent' then
    if tg_op='INSERT' then perform hipco_push(sm||' sent '||upper(regexp_replace(coalesce(d->>'offer',''),'^(sl)-?(\d+).*$','\1\2','i')), 'WhatsApp sent to '||coalesce(d->>'client',d->>'company','a client'));
    end if;
  elsif new.col = 'followup' then
    if tg_op='INSERT' or st <> ost then perform hipco_push(sm||': '||coalesce(d->>'client',d->>'company','client')||' '||replace(coalesce(nullif(st,''),'note'),'_',' ')||' on '||upper(regexp_replace(coalesce(d->>'offer',''),'^(sl)-?(\d+).*$','\1\2','i')), coalesce(left(d->>'note',120),'Open the app for details'));
    end if;
  elsif new.col = 'stocklots' then
    if tg_op='UPDATE' and st <> ost and st <> '' then perform hipco_push('List '||rf||' '||case st when 'available' then 'available again' else 'marked '||st end, 'Open the app to see it');
    end if;
  end if;
  return new;
end $f$;

drop trigger if exists hipco_kv_alert on public.kv;
create trigger hipco_kv_alert after insert or update on public.kv
  for each row when (new.col in ('inquiries','reminders','sent','followup','stocklots'))
  execute function public.hipco_kv_alert();
