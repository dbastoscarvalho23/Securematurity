import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [isSeeding, setIsSeeding] = useState(false);
  const queryClient = useQueryClient();

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 500),
  });

  const seedFrameworks = async () => {
    setIsSeeding(true);
    const fwData = [
      { code: 'NIS2', name: 'NIS2 / Decreto-Lei n.º 125/2025', version: '2025', description: 'Portuguese transposition of EU NIS2 Directive', status: 'active' },
      { code: 'ISO27001', name: 'ISO/IEC 27001:2022', version: '2022', description: 'Information security management system standard', status: 'active' },
      { code: 'NIST_CSF', name: 'NIST Cybersecurity Framework', version: '2.0', description: 'NIST framework for managing cybersecurity risk', status: 'active' },
      { code: 'CIS_V8', name: 'CIS Controls v8', version: '8.0', description: 'Center for Internet Security critical security controls', status: 'active' },
    ];
    await base44.entities.Framework.bulkCreate(fwData);

    // Seed sample questions
    const sampleQuestions = [
      // NIS2
      { framework_code: 'NIS2', domain: 'Governance', control_id: 'NIS2-GOV-01', question_text: 'Does the organization have a formal cybersecurity governance structure with clear roles and responsibilities?', order_index: 1, weight: 3, guidance: 'Look for documented roles, CISO appointment, board-level oversight.' },
      { framework_code: 'NIS2', domain: 'Governance', control_id: 'NIS2-GOV-02', question_text: 'Is there a comprehensive cybersecurity policy approved by top management?', order_index: 2, weight: 3 },
      { framework_code: 'NIS2', domain: 'Risk Management', control_id: 'NIS2-RM-01', question_text: 'Does the organization conduct regular cybersecurity risk assessments?', order_index: 3, weight: 3 },
      { framework_code: 'NIS2', domain: 'Risk Management', control_id: 'NIS2-RM-02', question_text: 'Is there a documented risk treatment plan with timelines and ownership?', order_index: 4, weight: 2 },
      { framework_code: 'NIS2', domain: 'Incident Response', control_id: 'NIS2-IR-01', question_text: 'Does the organization have an incident response plan aligned with NIS2 notification requirements?', order_index: 5, weight: 3 },
      { framework_code: 'NIS2', domain: 'Incident Response', control_id: 'NIS2-IR-02', question_text: 'Is the organization capable of reporting significant incidents within 24 hours as required by NIS2?', order_index: 6, weight: 3 },
      { framework_code: 'NIS2', domain: 'Supply Chain Security', control_id: 'NIS2-SC-01', question_text: 'Does the organization assess and manage cybersecurity risks in its supply chain?', order_index: 7, weight: 2 },
      { framework_code: 'NIS2', domain: 'Business Continuity', control_id: 'NIS2-BC-01', question_text: 'Is there a tested business continuity plan that addresses cyber incidents?', order_index: 8, weight: 2 },

      // ISO 27001
      { framework_code: 'ISO27001', domain: 'Information Security Policies', control_id: 'A.5.1', question_text: 'Are information security policies defined, approved by management, and communicated to all employees?', order_index: 1, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Organization of Information Security', control_id: 'A.5.2', question_text: 'Are information security roles and responsibilities clearly assigned and documented?', order_index: 2, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Asset Management', control_id: 'A.5.9', question_text: 'Is there a complete inventory of information assets with assigned owners?', order_index: 3, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Access Control', control_id: 'A.5.15', question_text: 'Is there a formal access control policy based on the principle of least privilege?', order_index: 4, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Cryptography', control_id: 'A.8.24', question_text: 'Is there a policy on the use of cryptographic controls and key management?', order_index: 5, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Physical Security', control_id: 'A.7.1', question_text: 'Are physical security perimeters defined and secured for critical areas?', order_index: 6, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Operations Security', control_id: 'A.8.7', question_text: 'Are malware protection controls implemented and regularly updated?', order_index: 7, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Incident Management', control_id: 'A.5.24', question_text: 'Is there a structured incident management process with defined severity levels?', order_index: 8, weight: 3 },

      // NIST CSF
      { framework_code: 'NIST_CSF', domain: 'Identify (ID)', control_id: 'ID.AM-1', question_text: 'Are all physical devices and systems within the organization inventoried?', order_index: 1, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Identify (ID)', control_id: 'ID.RA-1', question_text: 'Are asset vulnerabilities identified and documented?', order_index: 2, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Protect (PR)', control_id: 'PR.AC-1', question_text: 'Are identities and credentials managed for authorized devices and users?', order_index: 3, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Protect (PR)', control_id: 'PR.AT-1', question_text: 'Are all users informed and trained on cybersecurity awareness?', order_index: 4, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Detect (DE)', control_id: 'DE.CM-1', question_text: 'Is the network monitored to detect potential cybersecurity events?', order_index: 5, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Respond (RS)', control_id: 'RS.RP-1', question_text: 'Is a response plan executed during or after a detected cybersecurity event?', order_index: 6, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Recover (RC)', control_id: 'RC.RP-1', question_text: 'Is a recovery plan executed during or after a cybersecurity event?', order_index: 7, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Govern (GV)', control_id: 'GV.OC-1', question_text: 'Is cybersecurity risk management integrated into the organizational risk management program?', order_index: 8, weight: 3 },

      // CIS Controls v8
      { framework_code: 'CIS_V8', domain: 'Inventory and Control of Enterprise Assets', control_id: 'CIS-1', question_text: 'Does the organization maintain an accurate and up-to-date inventory of all enterprise assets?', order_index: 1, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Inventory and Control of Software Assets', control_id: 'CIS-2', question_text: 'Is there a complete inventory of all authorized and unauthorized software?', order_index: 2, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Data Protection', control_id: 'CIS-3', question_text: 'Are data management processes and technical controls in place to identify, classify, and protect sensitive data?', order_index: 3, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Secure Configuration', control_id: 'CIS-4', question_text: 'Are secure configurations established and maintained for enterprise assets and software?', order_index: 4, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Account Management', control_id: 'CIS-5', question_text: 'Is there a process to manage credentials and access control for user, admin, and service accounts?', order_index: 5, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Access Control Management', control_id: 'CIS-6', question_text: 'Are access control management processes defined and implemented using least privilege principles?', order_index: 6, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Continuous Vulnerability Management', control_id: 'CIS-7', question_text: 'Is there a continuous vulnerability management process to identify, remediate, and minimize the window of opportunity for attackers?', order_index: 7, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Audit Log Management', control_id: 'CIS-8', question_text: 'Are audit logs collected, managed, and analyzed to detect anomalies?', order_index: 8, weight: 2 },
    ];

    await base44.entities.Question.bulkCreate(sampleQuestions);

    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    setIsSeeding(false);
    toast.success('Frameworks and questions seeded successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform configuration and framework management</p>
      </div>

      <Tabs defaultValue="frameworks">
        <TabsList>
          <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
          <TabsTrigger value="seed">Seed Data</TabsTrigger>
        </TabsList>

        <TabsContent value="frameworks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Active Frameworks
              </CardTitle>
              <CardDescription>Compliance frameworks configured in the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No frameworks configured. Go to "Seed Data" tab to initialize.
                </p>
              ) : (
                <div className="space-y-3">
                  {frameworks.map(fw => {
                    const fwQuestions = questions.filter(q => q.framework_code === fw.code);
                    const domains = [...new Set(fwQuestions.map(q => q.domain))];
                    return (
                      <div key={fw.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{fw.name}</p>
                            <Badge variant="outline" className="text-xs font-mono">{fw.code}</Badge>
                          </div>
                          <Badge className="bg-accent/10 text-accent">{fw.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{fw.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {fwQuestions.length} questions · {domains.length} domains · Version {fw.version}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seed" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Initialize Platform Data</CardTitle>
              <CardDescription>
                Seed the platform with the 4 compliance frameworks and sample assessment questions.
                Only use this once during initial setup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={seedFrameworks} disabled={isSeeding} className="gap-2">
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <SettingsIcon className="w-4 h-4" />}
                {isSeeding ? 'Seeding...' : 'Seed Frameworks & Questions'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}