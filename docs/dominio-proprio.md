# Domínio próprio: app.ankoraone.com

Estado a 26 de outubro de 2026: o domínio está **verificado e ligado à app nativa AnkoraOne_DC_Repo** (id `6adf8df867faaf60a171efa5`). Saiu da app antiga Securematurity, que fica só como cópia de segurança em `securematurity-80cb9ed8.base44.app`.

## Registos na Cloudflare (zona ankoraone.com)

| Tipo | Nome | Valor | Proxy | Para quê |
|---|---|---|---|---|
| A | `app` | `216.24.57.1` | conforme está hoje | App (alojamento do Base44) |
| CNAME | `www.app` | `base44.onrender.com` | conforme está hoje | Redirecionamento |
| CNAME | `em.app` | `u117374045.wl046.sendgrid.net` | **DNS only** | Envio de email da plataforma |
| CNAME | `s1._domainkey.app` | `s1.domainkey.u117374045.wl046.sendgrid.net` | **DNS only** | DKIM |
| CNAME | `s2._domainkey.app` | `s2.domainkey.u117374045.wl046.sendgrid.net` | **DNS only** | DKIM |

Os registos de email têm de estar com a nuvem cinzenta («DNS only»): com o proxy ligado respondem com o IP da Cloudflare e o Base44 não os verifica.

Se a zona tiver registos `CAA`, acrescente `0 issue "letsencrypt.org"` e `0 issue "pki.goog"` (autoridades usadas pelo alojamento).

## Proxy da Cloudflare em `app`

Hoje `app` passa pelo proxy da Cloudflare e funciona. Para o manter:
1. SSL/TLS → modo **Full (strict)** (nunca «Flexible»).
2. Se o certificado do Base44 deixar de renovar, mudar `app` para «DNS only» e voltar a verificar no Base44.

## Verificar

- `https://app.ankoraone.com` abre a app com certificado válido.
- Estado no Base44: API `POST /api/apps/{app_id}/custom-domains/{domain_id}/status` (`verificationStatus: verified`).
- Domínio de email: API `GET /api/apps/{app_id}/custom-email-domains` (`configuration_status: active`).
