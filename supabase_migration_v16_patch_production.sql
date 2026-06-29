-- =======================================================
-- MIGRATION: PRODUCTION PATCH - UNIFIED TIMESTAMP (V16)
-- Fixes notification_queue scheduled_for persistence from NEW.due_date
-- =======================================================

CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS TRIGGER AS $$
BEGIN

  -- DELETE TASK
  IF TG_OP = 'DELETE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = OLD.id;

    RETURN OLD;
  END IF;

  -- INSERT TASK
  IF TG_OP = 'INSERT' THEN
    IF (NEW.due_date IS NOT NULL) THEN
      INSERT INTO public.notification_queue (
        task_id,
        user_id,
        title,
        body,
        scheduled_for,
        idempotency_key
      )
      VALUES (
        NEW.id,
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.due_date::TIMESTAMPTZ,
        'task_due_' || NEW.id::text || '_' || NEW.due_date::text
      )
      ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for,
          status = 'pending',
          updated_at = now();
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE TASK
  IF TG_OP = 'UPDATE' THEN

    -- Cancela agendamentos antigos pendentes
    UPDATE public.notification_queue
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = NEW.id
    AND status = 'pending';

    -- Recria com nova data e hora exatas de NEW.due_date (se não concluída)
    IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
      INSERT INTO public.notification_queue (
        task_id,
        user_id,
        title,
        body,
        scheduled_for,
        idempotency_key
      )
      VALUES (
        NEW.id,
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.due_date::TIMESTAMPTZ,
        'task_due_' || NEW.id::text || '_' || NEW.due_date::text
      )
      ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for,
          status = 'pending',
          updated_at = now();
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_task_notifications IS 'Persiste scheduled_for exatamente com NEW.due_date (Data + Hora) sem parsing ou gambiarras';
