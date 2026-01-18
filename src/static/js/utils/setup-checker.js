/**
 * Setup Completion Checker
 * Evaluates profile completeness and guides users through setup
 */

/**
 * Check setup completion status for a profile
 * @param {object} profile - Profile object
 * @returns {object} - Completion status with checklist items
 */
export function checkSetupCompletion(profile) {
    const checklist = [];

    // 1. Basic Profile Information
    const hasBasicInfo = !!(
        profile?.birth_date &&
        profile?.retirement_date &&
        (profile?.data?.person?.name || profile?.name)  // Fallback to top-level name for older profiles
    );
    checklist.push({
        id: 'basic_info',
        label: 'Complete basic profile information',
        description: 'Name, birth date, and retirement date',
        completed: hasBasicInfo,
        tab: 'profile',
        priority: 1
    });

    // 2. Assets
    const hasAssets = profile?.data?.assets &&
                      Object.keys(profile.data.assets).length > 0 &&
                      Object.values(profile.data.assets).some(category =>
                          Array.isArray(category) && category.length > 0
                      );
    checklist.push({
        id: 'assets',
        label: 'Add your assets',
        description: 'Retirement accounts, investments, real estate, etc.',
        completed: hasAssets,
        tab: 'assets',
        priority: 2
    });

    // 3. Income
    const hasIncome = profile?.data?.budget?.income && (
        (profile.data.budget.income.current?.employment?.primary_person > 0) ||
        (profile.data.budget.income.current?.employment?.spouse > 0) ||
        Object.values(profile.data.budget.income.current || {}).some(category =>
            Array.isArray(category) && category.length > 0
        )
    );
    checklist.push({
        id: 'income',
        label: 'Add your income sources',
        description: 'Employment, rental income, business income, etc.',
        completed: hasIncome,
        tab: 'income',
        priority: 3
    });

    // 4. Expenses
    const hasExpenses = profile?.data?.budget?.expenses && (
        Object.values(profile.data.budget.expenses.current || {}).some(category =>
            Array.isArray(category) ? category.length > 0 : (category?.amount > 0)
        )
    );
    checklist.push({
        id: 'expenses',
        label: 'Add your expenses',
        description: 'Housing, transportation, food, healthcare, etc.',
        completed: hasExpenses,
        tab: 'budget',
        priority: 4
    });

    // 5. Run Analysis
    const hasAnalysis = profile?.last_analysis_date ||
                       (profile?.data?.scenarios && profile.data.scenarios.length > 0);
    checklist.push({
        id: 'analysis',
        label: 'Run retirement analysis',
        description: 'Monte Carlo simulation to assess retirement readiness',
        completed: hasAnalysis,
        tab: 'analysis',
        priority: 5
    });

    // Calculate completion percentage
    const completedCount = checklist.filter(item => item.completed).length;
    const totalCount = checklist.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    // Determine if setup is complete
    const isComplete = completedCount === totalCount;

    // Get next incomplete item
    const nextItem = checklist.find(item => !item.completed);

    return {
        isComplete,
        percentage,
        completedCount,
        totalCount,
        checklist,
        nextItem
    };
}

/**
 * Get a friendly message based on completion status
 * @param {number} percentage - Completion percentage
 * @returns {string} - Friendly message
 */
export function getSetupMessage(percentage) {
    if (percentage === 100) {
        return "✅ Your profile is complete!";
    } else if (percentage >= 75) {
        return "Almost there! Just a few more steps.";
    } else if (percentage >= 50) {
        return "You're halfway through setup!";
    } else if (percentage >= 25) {
        return "Good start! Keep going.";
    } else {
        return "Let's get your profile set up!";
    }
}
