create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'washulog_project_url') then
    perform vault.create_secret(
      'https://mtshsijgfmottgkbgnir.supabase.co',
      'washulog_project_url',
      '和酒ログ Edge Function URL for scheduled jobs'
    );
  end if;
  if not exists (select 1 from vault.secrets where name = 'washulog_publishable_key') then
    perform vault.create_secret(
      'sb_publishable_iN9jbt45ga1sPbzt5aw-0w_iWs8eWW-',
      'washulog_publishable_key',
      '和酒ログ publishable key for scheduled Edge Function calls'
    );
  end if;
end
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-personal-data-exports';

select cron.schedule(
  'cleanup-personal-data-exports',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'washulog_project_url'
    ) || '/functions/v1/personal-data-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'washulog_publishable_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'washulog_publishable_key'
      )
    ),
    body := '{"action":"cleanup_expired"}'::jsonb,
    timeout_milliseconds := 15000
  ) as request_id;
  $cron$
);

