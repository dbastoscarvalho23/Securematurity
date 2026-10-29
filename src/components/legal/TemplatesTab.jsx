import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, Download, Info } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { TEMPLATE_PACKS, templateUrl } from '@/lib/legal/templatesCatalog';

/** Modelos e relatórios por referencial, gerados a partir dos textos oficiais da Biblioteca Legal. */
export default function TemplatesTab() {
  const { t, language } = useLanguage();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex gap-2 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
        <p>{t('legal_templates_intro')}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {TEMPLATE_PACKS.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <Badge variant="outline" className="text-[10px] mt-1">{p.source}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{language === 'pt' ? p.pt : p.en}</p>
              <div className="flex flex-wrap gap-2">
                {p.files.map((f) => {
                  const Icon = f.kind === 'xlsx' ? FileSpreadsheet : FileText;
                  return (
                    <Button key={f.name} asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                      <a href={templateUrl(f)} download={f.name}>
                        <Icon className="w-3.5 h-3.5" />{f.kind === 'xlsx' ? t('legal_templates_xlsx') : t('legal_templates_docx')}<Download className="w-3 h-3 opacity-60" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('legal_templates_note')}</p>
    </div>
  );
}
