import React from 'react';
import { useSalesAdminOptions } from './SalesHeaderFilter';
import { AdminActivitiesTab } from './AdminActivitiesTab';
import { AdminSchedulesTab } from './AdminSchedulesTab';
import { LoadingDurationTab } from './LoadingDurationTab';
import { SkillMatrixTab } from './SkillMatrixTab';
import { JobdeskConfigTab } from './JobdeskConfigTab';

export type SalesAdminSubTab =
  | 'dashboard'
  | 'activities'
  | 'schedules'
  | 'loading_duration'
  | 'skill_matrix'
  | 'jobdesk';

interface SalesAdminHubProps {
  activeSubTab: SalesAdminSubTab;
  onSelectSubTab: (subTab: SalesAdminSubTab) => void;
}

export const SalesAdminHub: React.FC<SalesAdminHubProps> = ({
  activeSubTab,
  onSelectSubTab
}) => {
  const adminOptions = useSalesAdminOptions();
  const effectiveTab: SalesAdminSubTab = activeSubTab === 'dashboard' ? 'activities' : activeSubTab;

  return (
    <div className="space-y-4">
      {effectiveTab === 'activities' && (
        <AdminActivitiesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'schedules' && (
        <AdminSchedulesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'loading_duration' && (
        <LoadingDurationTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'skill_matrix' && (
        <SkillMatrixTab adminOptions={adminOptions} />
      )}
      {effectiveTab === 'jobdesk' && (
        <JobdeskConfigTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
    </div>
  );
};
