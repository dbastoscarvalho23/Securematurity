import React from 'react';
import IsoGuideTab, { ISO_GUIDES } from './IsoGuideTab';

/** Registos do guia ISO/IEC 42001 (sistema de gestão da IA) na entidade ComplianceChecklist. */
export const ISO42001_FRAMEWORK = ISO_GUIDES.iso42001.framework;

export default function Iso42001Tab() {
  return <IsoGuideTab guide="iso42001" />;
}
