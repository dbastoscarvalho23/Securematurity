import { json } from '../../shared/http.ts';

// Desativada: esta função copiava ficheiros públicos para o Google Drive/OneDrive e criava uma
// partilha aberta a qualquer pessoa («anyone» / link «anonymous»). Os carregamentos passaram para a
// função `files`, que guarda o ficheiro de forma privada no repositório do cliente e só o entrega
// a utilizadores autorizados, com URL temporário.
Deno.serve(() => json({ error: 'Função descontinuada: use a função «files».' }, 410));

