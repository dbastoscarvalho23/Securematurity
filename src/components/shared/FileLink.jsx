import React from 'react';
import { toast } from 'sonner';
import { openFile, isPrivateFile } from '@/lib/cloudStorage';

/**
 * Ligação para um ficheiro guardado. Os ficheiros privados (ankora-file://) abrem através da função `files`
 * (acesso verificado e registado, URL temporário); os antigos mantêm o link direto.
 * Aceita as mesmas props de um <a> e funciona dentro de <Button asChild>.
 */
const FileLink = React.forwardRef(function FileLink({ url, fileName, onClick, children, ...rest }, ref) {
  if (!url) return null;
  const priv = isPrivateFile(url);
  const handle = async (e) => {
    onClick?.(e);
    if (!priv || e.defaultPrevented) return;
    e.preventDefault();
    try { await openFile(url, fileName); } catch (err) { toast.error(err?.message || 'Não foi possível abrir o ficheiro'); }
  };
  const { download, ...aProps } = rest;
  return (
    <a ref={ref} {...aProps} href={priv ? '#' : url} {...(!priv && download ? { download } : {})} target="_blank" rel="noopener noreferrer" onClick={handle}>
      {children}
    </a>
  );
});

export default FileLink;
