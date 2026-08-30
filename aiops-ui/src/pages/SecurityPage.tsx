import React from 'react';
import { SecurityAuditView } from '../components/security/SecurityAuditView';

export const SecurityPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <SecurityAuditView />
    </div>
  );
};

