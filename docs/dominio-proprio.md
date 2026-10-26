# Domínio próprio: app.ankoraone.com (Cloudflare)

O domínio já foi acrescentado e ligado à app Securematurity no Base44 (verificação pendente até o DNS apontar).

## 1. Registo DNS no Cloudflare

Na zona `ankoraone.com` → DNS → Records → Add record:

| Tipo | Nome | Destino | Proxy | TTL |
|---|---|---|---|---|
| CNAME | `app` | `base44.onrender.com` | **DNS only** (nuvem cinzenta) | Auto |

- Deixe o proxy **desligado** (nuvem cinzenta). O alojamento do Base44 (Render) só emite o certificado TLS e
  verifica o domínio quando vê o pedido diretamente; com o proxy ligado a verificação e as renovações podem falhar.
- Não crie registos `AAAA`/`A` para `app` além do CNAME.
- Se a zona tiver registos `CAA`, acrescente `0 issue "letsencrypt.org"` e `0 issue "pki.goog"` (o Render usa
  estas autoridades).

## 2. Verificação

A verificação começa sozinha (o domínio já está «ligado» no Base44). Normalmente demora minutos; o certificado TLS
é emitido logo a seguir. Para confirmar: `https://app.ankoraone.com` deve abrir a app com certificado válido.

## 3. Se quiser o proxy do Cloudflare (WAF, cache)

Só depois de verificado e com certificado emitido:
1. SSL/TLS → Overview → modo **Full (strict)** (nunca «Flexible», que causa ciclos de redirecionamento).
2. Ative a nuvem laranja no registo `app`.
3. Confirme que a app e o início de sessão continuam a funcionar. Se o certificado do Base44 deixar de renovar,
   volte a «DNS only».

## 4. Depois de ativo

- O endereço `securematurity-80cb9ed8.base44.app` continua a funcionar; os utilizadores podem usar qualquer um.
- Envio de email com remetente `@ankoraone.com`: configurável no Base44 (domínio de email próprio, com registos
  SPF/DKIM no Cloudflare) — pedido à parte.
- Para a produção (AnkoraOne Plataforma GRC) use outro nome (ex.: `portal.ankoraone.com`) ou mova este domínio
  quando a produção passar a ser servida por esta app.
