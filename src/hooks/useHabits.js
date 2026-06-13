import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useHabits(user) {
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHabitsAndLogs();
    } else {
      setHabits([]);
      setHabitLogs([]);
      setLoading(false);
    }
  }, [user]);

  async function fetchHabitsAndLogs() {
    setLoading(true);
    try {
      const [habitsResponse, logsResponse] = await Promise.all([
        supabase.from('habits').select('*').order('created_at', { ascending: false }),
        supabase.from('habit_logs').select('*')
      ]);

      if (habitsResponse.error) throw habitsResponse.error;
      if (logsResponse.error) throw logsResponse.error;

      setHabits(habitsResponse.data || []);
      setHabitLogs(logsResponse.data || []);
    } catch (error) {
      console.error('Error fetching habits:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function addHabit(habitData) {
    if (!user) return null;
    const newHabit = {
      ...habitData,
      user_id: user.id
    };

    const { data, error } = await supabase
      .from('habits')
      .insert([newHabit])
      .select()
      .single();

    if (error) {
      console.error('Error adding habit:', error.message);
      return null;
    }

    setHabits(prev => [data, ...prev]);
    return data;
  }

  async function updateHabit(id, updates) {
    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating habit:', error.message);
      return null;
    }

    setHabits(prev => prev.map(h => (h.id === id ? data : h)));
    return data;
  }

  async function deleteHabit(id) {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting habit:', error.message);
      return false;
    }

    setHabits(prev => prev.filter(h => h.id !== id));
    setHabitLogs(prev => prev.filter(l => l.habit_id !== id));
    return true;
  }

  async function toggleHabitLog(habitId, dateStr) {
    if (!user) return false;

    // Check if it already exists
    const existingLog = habitLogs.find(l => l.habit_id === habitId && l.completed_date === dateStr);

    if (existingLog) {
      // Delete it (uncheck)
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('id', existingLog.id);

      if (error) {
        console.error('Error deleting habit log:', error.message);
        return false;
      }
      setHabitLogs(prev => prev.filter(l => l.id !== existingLog.id));
      return false; // Returns false to indicate it is now unchecked
    } else {
      // Add it (check)
      const newLog = {
        habit_id: habitId,
        user_id: user.id,
        completed_date: dateStr
      };

      const { data, error } = await supabase
        .from('habit_logs')
        .insert([newLog])
        .select()
        .single();

      if (error) {
        console.error('Error adding habit log:', error.message);
        return false;
      }
      setHabitLogs(prev => [...prev, data]);
      return true; // Returns true to indicate it is now checked
    }
  }

  return {
    habits,
    habitLogs,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitLog
  };
}
