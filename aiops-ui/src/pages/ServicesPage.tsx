import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Project, Service } from '../lib/types';
import { ServiceList } from '../components/services/ServiceList';
import { RegisterServiceModal } from '../components/services/RegisterServiceModal';
import { Server, RefreshCw } from 'lucide-react';

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [svcData, projData] = await Promise.all([api.getServices(), api.getProjects()]);
      setServices(svcData || []);
      setProjects(projData || []);
    } catch (err) {
      console.error('Error loading service registry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-accent-blue" />
            <span>Service Registry & Multi-Repo Mapping</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage microservice repositories, Fernet-encrypted GitHub credentials, and dedicated log drain webhooks.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs font-medium border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <ServiceList services={services} onOpenRegisterModal={() => setIsModalOpen(true)} />

      <RegisterServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        onCreated={fetchData}
      />
    </div>
  );
};
