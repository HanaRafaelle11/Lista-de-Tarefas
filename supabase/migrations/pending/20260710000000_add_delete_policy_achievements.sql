-- Permite que usuários autenticados revoguem/excluam suas próprias conquistas (RLS DELETE)
DROP POLICY IF EXISTS "Allow users to delete own achievements" ON public.user_achievements;
CREATE POLICY "Allow users to delete own achievements"
ON public.user_achievements FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
