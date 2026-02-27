# Omnilink WhatsApp App — Deploy no AWS EC2

Guia completo para colocar a aplicação em produção em uma instância EC2 com Docker.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar e configurar a instância EC2](#2-criar-e-configurar-a-instância-ec2)
3. [Instalar dependências no servidor](#3-instalar-dependências-no-servidor)
4. [Clonar o repositório](#4-clonar-o-repositório)
5. [Configurar o Supabase (banco de dados)](#5-configurar-o-supabase-banco-de-dados)
6. [Configurar variáveis de ambiente (.env)](#6-configurar-variáveis-de-ambiente-env)
7. [Build e execução com Docker Compose](#7-build-e-execução-com-docker-compose)
8. [Configurar domínio e HTTPS (Nginx + Certbot)](#8-configurar-domínio-e-https-nginx--certbot)
9. [Configurar webhooks na Twilio](#9-configurar-webhooks-na-twilio)
10. [Configurar o sender (número WhatsApp)](#10-configurar-o-sender-número-whatsapp)
11. [Verificação final](#11-verificação-final)
12. [Manutenção e operações](#12-manutenção-e-operações)

---

## 1. Pré-requisitos

Antes de começar, você precisa ter:

- **Conta AWS** com acesso ao EC2
- **Conta Supabase** (https://supabase.com) — projeto já criado
- **Conta Twilio** (https://twilio.com) com:
  - Account SID e Auth Token
  - Um número WhatsApp habilitado (ou WhatsApp Sandbox para testes)
- **Domínio** apontando para o IP da instância (ex.: `api.seudominio.com`)
- **Git** configurado com acesso ao repositório

---

## 2. Criar e configurar a instância EC2

### 2.1 Criar a instância

1. Acesse o **AWS Console** → **EC2** → **Launch Instance**
2. Configuração recomendada:
   - **AMI**: Ubuntu 24.04 LTS
   - **Tipo**: `t3.small` (mínimo) ou `t3.medium` (recomendado)
   - **Storage**: 30 GB gp3
   - **Key pair**: crie ou selecione uma chave `.pem`

### 2.2 Configurar o Security Group

Libere as seguintes portas no Security Group da instância:

| Porta  | Protocolo | Origem    | Uso                           |
|--------|-----------|-----------|-------------------------------|
| 22     | TCP       | Seu IP    | SSH                           |
| 80     | TCP       | 0.0.0.0/0 | HTTP (redirect para HTTPS)   |
| 443    | TCP       | 0.0.0.0/0 | HTTPS                        |
| 3000   | TCP       | 0.0.0.0/0 | Frontend (temporário, antes do Nginx) |
| 3001   | TCP       | 0.0.0.0/0 | API (temporário, antes do Nginx)      |

> Após configurar o Nginx como proxy reverso, remova as portas 3000 e 3001 do Security Group.

### 2.3 Conectar via SSH

```bash
chmod 400 sua-chave.pem
ssh -i sua-chave.pem ubuntu@<IP_PUBLICO_EC2>
```

---

## 3. Instalar dependências no servidor

Execute os comandos abaixo na instância EC2:

```bash
# Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Instalar Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Instalar Nginx e Certbot (para HTTPS)
sudo apt install -y nginx certbot python3-certbot-nginx

# Aplicar grupo docker (re-login)
newgrp docker
```

Verifique as instalações:

```bash
docker --version
docker compose version
nginx -v
```

---

## 4. Clonar o repositório

```bash
cd /home/ubuntu
git clone https://github.com/SEU_USUARIO/omnilink-whatsapp-app.git
cd omnilink-whatsapp-app
```

---

## 5. Configurar o Supabase (banco de dados)

### 5.1 Executar as migrations

Acesse o **Supabase Dashboard** → **SQL Editor** e execute, **na ordem**, cada arquivo de migration:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_flow_responses.sql`
3. `supabase/migrations/003_flow_responses_campaign.sql`
4. `supabase/migrations/004_analytics_indexes.sql`

### 5.2 Obter as credenciais

No Supabase Dashboard → **Settings** → **API**:

- **Project URL** → será o `SUPABASE_URL`
- **anon (public) key** → será o `SUPABASE_ANON_KEY`
- **service_role (secret) key** → será o `SUPABASE_SERVICE_ROLE_KEY`

---

## 6. Configurar variáveis de ambiente (.env)

```bash
cp .env.example .env
nano .env
```

Preencha o arquivo com os valores reais:

```env
# ── Supabase ────────────────────────────────────────────────────────────────
SUPABASE_URL=https://XXXXX.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# ── Twilio ───────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── App ──────────────────────────────────────────────────────────────────────
APP_SECRET=gere_um_segredo_aleatorio_com_32_caracteres
NODE_ENV=production
PORT=3001

# ── Worker ───────────────────────────────────────────────────────────────────
WORKER_POLL_INTERVAL_MS=3000
WORKER_CONCURRENCY=5
WORKER_ID=worker-1

# ── Frontend (variáveis públicas para o browser) ────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://XXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_API_URL=https://api.seudominio.com

# ── OpenAI (opcional, para funcionalidades de IA) ───────────────────────────
OPENAI_API_KEY=sk-...
```

### Detalhes importantes

| Variável | Onde obter |
|----------|------------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role secret |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info → Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info → Auth Token |
| `APP_SECRET` | Gere com: `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | A URL pública da sua API (com HTTPS) |

> **NEXT_PUBLIC_API_URL** é a URL que o browser do usuário usará para chamar a API.
> Em produção, deve ser `https://api.seudominio.com` (não `localhost`).

---

## 7. Build e execução com Docker Compose

```bash
# Build de todas as imagens
docker compose build

# Iniciar em background
docker compose up -d

# Verificar se está rodando
docker compose ps

# Ver logs em tempo real
docker compose logs -f
```

Teste rápido:

```bash
# API health check
curl http://localhost:3001/health

# Frontend
curl -s http://localhost:3000 | head -20
```

---

## 8. Configurar domínio e HTTPS (Nginx + Certbot)

### 8.1 Configurar DNS

No seu provedor de DNS, crie os registros A apontando para o IP público da EC2:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `app.seudominio.com` | `<IP_EC2>` |
| A | `api.seudominio.com` | `<IP_EC2>` |

### 8.2 Configurar o Nginx

```bash
sudo nano /etc/nginx/sites-available/omnilink
```

Cole o conteúdo:

```nginx
# Frontend
server {
    listen 80;
    server_name app.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API
server {
    listen 80;
    server_name api.seudominio.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

Ative e teste:

```bash
sudo ln -s /etc/nginx/sites-available/omnilink /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 Gerar certificados SSL

```bash
sudo certbot --nginx -d app.seudominio.com -d api.seudominio.com
```

O Certbot vai:
- Gerar os certificados Let's Encrypt
- Configurar automaticamente o HTTPS no Nginx
- Adicionar redirect HTTP → HTTPS

Verifique a renovação automática:

```bash
sudo certbot renew --dry-run
```

### 8.4 Remover portas 3000/3001 do Security Group

Após confirmar que o Nginx está funcionando, remova as portas 3000 e 3001 do Security Group da EC2. Todo o tráfego passará pelas portas 80/443 via Nginx.

---

## 9. Configurar webhooks na Twilio

Esta é a parte mais crítica — sem isso, a aplicação **não recebe** as respostas do WhatsApp.

### 9.1 Webhook de mensagens recebidas (inbound)

1. Acesse o **Twilio Console** → **Messaging** → **Settings** → **WhatsApp Senders** (ou WhatsApp Sandbox para testes)
2. No campo **"When a message comes in"**:
   ```
   https://api.seudominio.com/webhooks/twilio/inbound
   ```
   - Método: **HTTP POST**

### 9.2 Webhook de status de mensagens (status callback)

3. No campo **"Status callback URL"**:
   ```
   https://api.seudominio.com/webhooks/twilio/status
   ```
   - Método: **HTTP POST**

### 9.3 Para WhatsApp Sandbox (desenvolvimento)

Se estiver usando o Sandbox:

1. Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Em **Sandbox Configuration**:
   - **When a message comes in**: `https://api.seudominio.com/webhooks/twilio/inbound`
   - **Status callback URL**: `https://api.seudominio.com/webhooks/twilio/status`

### 9.4 Verificar conectividade

```bash
# Testar se o endpoint está acessível
curl -X POST https://api.seudominio.com/webhooks/twilio/inbound \
  -d "From=whatsapp:+5511999999999&To=whatsapp:+5511888888888&Body=teste&MessageSid=SM123"
```

Deve retornar `<Response></Response>` (ou 403 se validação de assinatura estiver ativa).

---

## 10. Configurar o sender (número WhatsApp)

Após o deploy, acesse a aplicação em `https://app.seudominio.com`:

1. Faça login (crie um usuário via Supabase Auth se necessário)
2. Vá em **Senders** → **Novo sender**
3. Preencha:
   - **Nome**: Nome do remetente (ex.: "Omnilink Oficial")
   - **Phone Number**: número em E.164 (ex.: `+551150398318`)
   - **Twilio From**: `whatsapp:+551150398318` (prefixo `whatsapp:` obrigatório)

> O `phone_number` é usado para identificar o sender quando webhooks chegam.
> O `twilio_from` é usado como remetente ao enviar mensagens via Twilio.

---

## 11. Verificação final

### Checklist de deploy

- [ ] Instância EC2 rodando com Docker
- [ ] Migrations do Supabase executadas (001 a 004)
- [ ] `.env` preenchido com todas as variáveis
- [ ] `docker compose up -d` com 3 containers saudáveis
- [ ] DNS configurado (`app.` e `api.` apontando para EC2)
- [ ] Nginx configurado como proxy reverso
- [ ] Certificado SSL ativo (HTTPS)
- [ ] Webhook inbound configurado na Twilio
- [ ] Webhook de status configurado na Twilio
- [ ] Sender cadastrado na aplicação
- [ ] `NEXT_PUBLIC_API_URL` apontando para `https://api.seudominio.com`
- [ ] Teste de envio de mensagem funcionando

### Teste end-to-end

1. Crie um **template** na aba Templates
2. Envie para **aprovação** (aguarde a Meta aprovar)
3. Crie uma **jornada** com: Start → Send Template → Wait for Reply → Send Template
4. Publique a jornada
5. Crie uma **lista** com pelo menos 1 contato
6. Crie uma **campanha** vinculando a jornada, lista e sender
7. Lance a campanha
8. Verifique se a mensagem chegou no WhatsApp
9. Responda no WhatsApp e verifique se a jornada avança

---

## 12. Manutenção e operações

### Atualizar a aplicação

```bash
cd /home/ubuntu/omnilink-whatsapp-app
git pull origin main
docker compose build
docker compose up -d
```

### Ver logs

```bash
# Todos os serviços
docker compose logs -f

# Apenas o worker (debug de jornadas)
docker compose logs -f worker

# Apenas a API (debug de webhooks)
docker compose logs -f api

# Últimas 200 linhas do worker
docker compose logs worker --tail=200
```

### Reiniciar serviços

```bash
# Reiniciar tudo
docker compose restart

# Reiniciar apenas o worker
docker compose restart worker

# Rebuild e restart
docker compose up -d --build
```

### Escalar o worker

Para processar mais jornadas em paralelo, edite `docker-compose.yml`:

```yaml
worker:
  deploy:
    replicas: 3  # 3 workers processando jobs em paralelo
```

Ou ajuste as variáveis no `.env`:

```env
WORKER_CONCURRENCY=10    # jobs simultâneos por worker
WORKER_POLL_INTERVAL_MS=1000  # polling mais frequente
```

### Limpar cache do Docker

```bash
# Remover imagens e cache antigos
docker system prune -f

# Remover tudo (incluindo volumes)
docker system prune -a --volumes
```

### Monitoramento básico

```bash
# Status dos containers
docker compose ps

# Uso de recursos
docker stats

# Espaço em disco
df -h
```

---

## Troubleshooting

### Webhook não chega (jornada não avança)

1. Verifique se a URL no Twilio está correta: `https://api.seudominio.com/webhooks/twilio/inbound`
2. Teste com curl: `curl -X POST https://api.seudominio.com/webhooks/twilio/inbound`
3. Verifique logs: `docker compose logs -f api | grep webhook`
4. Certifique-se de que `X-Forwarded-Proto` e `X-Forwarded-Host` estão sendo passados pelo Nginx

### Erro 403 no webhook

A validação de assinatura Twilio está falhando. Verifique:
- O `TWILIO_AUTH_TOKEN` no `.env` está correto
- O Nginx está passando os headers `X-Forwarded-Proto` e `X-Forwarded-Host`
- `app.set('trust proxy', true)` está no código da API

### Container reiniciando em loop

```bash
docker compose logs <servico> --tail=50
```

Causas comuns:
- Variáveis de ambiente faltando no `.env`
- Supabase URL ou keys incorretas
- Porta já em uso

### Build falha com erro de cache

```bash
docker builder prune -f
docker compose build --no-cache
docker compose up -d
```
