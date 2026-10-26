import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  REPOSITORY_FOLDERS, CONTEXT_FOLDER, normalizeStorageRoot, defaultStorageRoot, effectiveStorageRoot,
  evidenceFolderKey, storedFileFolderKey, evidenceFileFolderKey, folderKeyFromLabel,
} from '@/lib/repository';

const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'base44/shared/storage.ts'), 'utf8');
const block = (name, end) => {
  const start = serverSrc.indexOf(`export const ${name} =`);
  return serverSrc.slice(start, serverSrc.indexOf(end, start));
};

describe('cópia do servidor (base44/shared/storage.ts)', () => {
  it('as 13 pastas são iguais', () => {
    const server = [...block('REPOSITORY_FOLDERS', '];').matchAll(/\{ key: "([^"]+)", label: "([^"]+)" \}/g)].map((m) => ({ key: m[1], label: m[2] }));
    expect(server).toEqual(REPOSITORY_FOLDERS);
    expect(server).toHaveLength(13);
  });
  it('o mapa contexto → pasta é igual', () => {
    const server = Object.fromEntries([...block('CONTEXT_FOLDER', '};').matchAll(/^\s+(\w+): "(\w+)",$/gm)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(CONTEXT_FOLDER);
  });
  it('as pastas do mapa existem', () => {
    const keys = REPOSITORY_FOLDERS.map((f) => f.key);
    Object.values(CONTEXT_FOLDER).forEach((k) => expect(keys).toContain(k));
  });
});

describe('normalizeStorageRoot', () => {
  it('vazio = localização por omissão', () => {
    expect(normalizeStorageRoot('')).toBe('');
    expect(normalizeStorageRoot(null)).toBe('');
    expect(normalizeStorageRoot(' / ')).toBe('');
  });
  it('limpa cada pasta e tira acentos', () => {
    expect(normalizeStorageRoot('/AnkoraOne/Neora Consulting/')).toBe('AnkoraOne/Neora Consulting');
    expect(normalizeStorageRoot('Clientes/Câmara Municipal')).toBe('Clientes/Camara Municipal');
    expect(normalizeStorageRoot('A\\B')).toBe('A/B');
    expect(normalizeStorageRoot('A/<script>')).toBe('A/_script_');
  });
  it('recusa pastas vazias, «.» e «..»', () => {
    expect(() => normalizeStorageRoot('A//B')).toThrow('repo_err_empty_segment');
    expect(() => normalizeStorageRoot('A/../B')).toThrow('repo_err_dots');
    expect(() => normalizeStorageRoot('./A')).toThrow('repo_err_dots');
  });
  it('limites de 6 pastas e 200 caracteres', () => {
    expect(normalizeStorageRoot('1/2/3/4/5/6')).toBe('1/2/3/4/5/6');
    expect(() => normalizeStorageRoot('1/2/3/4/5/6/7')).toThrow('repo_err_segments');
    expect(() => normalizeStorageRoot(`${'a'.repeat(120)}/${'b'.repeat(120)}`)).toThrow('repo_err_length');
  });
});

describe('localização efetiva', () => {
  const c = { id: '6650abcdef123456', name: 'Neora Consulting' };
  it('por omissão usa o nome e o fim do id', () => {
    expect(defaultStorageRoot(c)).toBe('AnkoraOne/Neora Consulting-123456');
    expect(effectiveStorageRoot(c)).toBe('AnkoraOne/Neora Consulting-123456');
  });
  it('a escolhida prevalece; inválida é ignorada', () => {
    expect(effectiveStorageRoot({ ...c, storage_root: 'Clientes/Neora' })).toBe('Clientes/Neora');
    expect(effectiveStorageRoot({ ...c, storage_root: 'A/../B' })).toBe('AnkoraOne/Neora Consulting-123456');
  });
});

describe('pastas de ficheiros e evidências', () => {
  it('evidências: ativos restritos, incidentes, fornecedores, enquadramento e geral', () => {
    expect(evidenceFolderKey([{ type: 'asset' }], false)).toBe('assets');
    expect(evidenceFolderKey([{ type: 'measure' }], true, 'framing')).toBe('assets');
    expect(evidenceFolderKey([{ type: 'checklist' }], false, 'framing')).toBe('framing');
    expect(evidenceFolderKey([{ type: 'incident' }], false)).toBe('incidents');
    expect(evidenceFolderKey([{ type: 'supplier' }], false)).toBe('suppliers');
    expect(evidenceFolderKey([{ type: 'measure' }], false)).toBe('evidence');
    expect(evidenceFolderKey([], false)).toBe('evidence');
  });
  it('registos antigos sem pasta usam o contexto ou as ligações', () => {
    expect(storedFileFolderKey({ context: 'nomination' })).toBe('security_docs');
    expect(storedFileFolderKey({ context: 'comment' })).toBe('other');
    expect(storedFileFolderKey({ context: 'training', folder: '09 Formação' })).toBe('training');
    expect(evidenceFileFolderKey({ links: [{ type: 'component' }] })).toBe('assets');
    expect(evidenceFileFolderKey({ folder: '01 Enquadramento', links: [] })).toBe('framing');
    expect(folderKeyFromLabel('desconhecida')).toBe(null);
    expect(storedFileFolderKey({ context: 'intake' })).toBe('inbox');
    expect(folderKeyFromLabel('00 Por classificar')).toBe('inbox');
  });
});