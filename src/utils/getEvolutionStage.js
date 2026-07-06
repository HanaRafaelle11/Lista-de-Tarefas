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
  
  const { weeklyTotal = 0, currentStreak = 0, completedGoalsCount = 0, consistencyScore = 0 } = progress;

  if (weeklyTotal >= 15 || currentStreak >= 7 || completedGoalsCount >= 2 || consistencyScore >= 85) {
    return Math.min(3, totalStages - 1);
  }
  if (weeklyTotal >= 7 || currentStreak >= 4 || completedGoalsCount >= 1 || consistencyScore >= 50) {
    return Math.min(2, totalStages - 1);
  }
  if (weeklyTotal >= 2 || currentStreak >= 2 || consistencyScore >= 20) {
    return Math.min(1, totalStages - 1);
  }
  
  return 0;
}
