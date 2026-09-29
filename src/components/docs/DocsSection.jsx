import React from 'react';

/**
 * Capítulo da folha «Papel Dourado» (/documentacao-tecnica).
 *
 * O número do capítulo (dois dígitos) abre a secção com o fio dourado; o título
 * e a descrição vivem ao lado. O conteúdo só aparece embrulhado em
 * `chapter-content`, que traz a linha de separação — é a mesma moldura para as
 * onze secções.
 */
export default function DocsSection({ id, index, title, description, children }) {
  return (
    <section id={id} className="chapter">
      <div className="chapter-head">
        <div className="chapter-no">{String(index).padStart(2, '0')}</div>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children && <div className="chapter-content space-y-5">{children}</div>}
    </section>
  );
}
