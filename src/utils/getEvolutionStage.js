/**
 * getEvolutionStage.js
 * 
 * Reusable and pure function to calculate the 0-indexed evolution stage
 * based on the user's current progress metrics.
 * 
 * @param {Object} progress
 * @param {number} progress.weeklyTotal - Sum of tasks completed in the last 7 days
 * @param {number} progress.currentStreak - Active task streak in days
 * @param {number} progress.completedGoalsCount - Count of completed goals
 * @param {number} [totalStages=4] - Total stages supported by the category
 * @returns {number} 0-indexed stage number (0 to totalStages - 1)
 */
export function getEvolutionStage(progress, totalStages = 4) {
  if (!progress) return 0;
  
  const { completedGoalsCount = 0 } = progress;

  if (completedGoalsCount >= 245) {
    return Math.min(4, totalStages - 1);
  }
  if (completedGoalsCount >= 145) {
    return Math.min(3, totalStages - 1);
  }
  if (completedGoalsCount >= 75) {
    return Math.min(2, totalStages - 1);
  }
  if (completedGoalsCount >= 30) {
    return Math.min(1, totalStages - 1);
  }
  
  return 0;
}
