import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import InstrumentsTab from '@/components/legal/InstrumentsTab';
import QnrcsTab from '@/components/legal/QnrcsTab';
import MeasuresTab from '@/components/legal/MeasuresTab';
import RelationsTab from '@/components/legal/RelationsTab';
import ObligationsTab from '@/components/legal/ObligationsTab';
import ComplianceTab from '@/components/legal/ComplianceTab';
import Iso27001Tab from '@/components/legal/Iso27001Tab';
import Iso42001Tab from '@/components/legal/Iso42001Tab';
import TemplatesTab from '@/components/legal/TemplatesTab';

const TABS = [
  ['instruments', 'legal_tab_instruments', InstrumentsTab],
  ['qnrcs', 'legal_tab_qnrcs', QnrcsTab],
  ['measures', 'legal_tab_measures', MeasuresTab],
  ['obligations', 'legal_tab_obligations', ObligationsTab],
  ['relations', 'legal_tab_relations', RelationsTab],
  ['compliance', 'legal_tab_compliance', ComplianceTab],
  ['iso27001', 'legal_tab_iso27001', Iso27001Tab],
  ['iso42001', 'legal_tab_iso42001', Iso42001Tab],
  ['templates', 'legal_tab_templates', TemplatesTab],
];

export default function LegalLibrary() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter(([id]) => id !== 'compliance' || user?.role === 'admin' || user?.customer_id);
  const active = tabs.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'instruments';

  return (
    <div className="space-y-6">
      <PageHeader title={t('legal_title')} description={t('legal_subtitle')} />
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="flex flex-wrap h-auto justify-start">
          {tabs.map(([id, key]) => <TabsTrigger key={id} value={id}>{t(key)}</TabsTrigger>)}
        </TabsList>
        {tabs.map(([id, , Component]) => (
          <TabsContent key={id} value={id} className="mt-4">
            {active === id && <Component />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
