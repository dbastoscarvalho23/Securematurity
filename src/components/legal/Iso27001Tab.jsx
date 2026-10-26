import React from 'react';
import IsoGuideTab, { ISO_GUIDES } from './IsoGuideTab';

/** Registos do guia ISO/IEC 27001 na entidade ComplianceChecklist. */
export const ISO_FRAMEWORK = ISO_GUIDES.iso27001.framework;

export default function Iso27001Tab() {
  return <IsoGuideTab guide="iso27001" />;
}
