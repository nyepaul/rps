-- Create feature_roadmap table for super admin planning

CREATE TABLE IF NOT EXISTS feature_roadmap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK(category IN (
        'Healthcare & Medical',
        'Tax Planning',
        'Debt Management',
        'Education Funding',
        'Insurance Analysis',
        'Social Security',
        'Estate Planning',
        'Business Owner',
        'Investment Analysis',
        'Life Events',
        'Pension & Annuity',
        'Real Estate',
        'RMD Planning',
        'Cash Flow',
        'Scenario Modeling',
        'Withdrawal Strategy',
        'Family & Legacy',
        'Retirement Lifestyle',
        'Risk Analysis',
        'Compliance & Documentation',
        'Technical Improvements',
        'UI/UX Enhancements'
    )),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
    phase TEXT DEFAULT 'backlog' CHECK(phase IN ('phase1', 'phase2', 'phase3', 'backlog', 'completed')),
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    impact TEXT CHECK(impact IN ('high', 'medium', 'low')),
    effort TEXT CHECK(effort IN ('small', 'medium', 'large', 'xl')),
    target_version TEXT,
    assigned_to TEXT,
    notes TEXT,
    related_items TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_roadmap_category ON feature_roadmap(category);
CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON feature_roadmap(priority);
CREATE INDEX IF NOT EXISTS idx_roadmap_phase ON feature_roadmap(phase);
CREATE INDEX IF NOT EXISTS idx_roadmap_status ON feature_roadmap(status);

-- Update alembic version
INSERT INTO alembic_version (version_num) VALUES ('a1b2c3d4e5f6');
