import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import ExternalAccess from './ExternalAccess';
import UserAssignments from './UserAssignments';

/**
 * Delegações — entrada única da administração de acessos externos.
 *
 * Resultado da fusão de «Acesso Externo» (/external-access, que agora
 * redireciona para aqui) com «Delegações» (/user-assignments): a página reúne o
 * ciclo de vida da delegação — pedido, aprovação, recusa, revogação e onboarding
 * — e, para quem administra, a atribuição direta por utilizador e cliente.
 *
 * Os dois painéis são os componentes que já existiam (`ExternalAccess` e
 * `UserAssignments`, este em modo `embedded`), pelo que nenhuma capacidade foi
 * reescrita nem perdida: cada um mantém o seu âmbito e as suas permissões.
 */
export default function Delegations() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <ExternalAccess />

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-foreground">{t('delegations_assignments_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('delegations_assignments_desc')}</p>
        </div>
        <UserAssignments embedded />
      </section>
    </div>
  );
}
