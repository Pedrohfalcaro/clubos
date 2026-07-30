# Configuração Firebase — ClubOS

## 1. Criar projeto
1. Acesse https://console.firebase.google.com
2. Crie um projeto (ou use um existente)
3. Adicione um app **Web** e copie as credenciais

## 2. Ativar serviços
- **Authentication** → Sign-in method → **Google** → Enable
- **Firestore Database** → Create database (modo produção)
  - Regras (só o dono lê/escreve; inclui save em chunks):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      function isOwner() {
        return request.auth != null && request.auth.uid == userId;
      }
      function validSlot(slotId) {
        return slotId in ['1', '2', '3'];
      }
      match /data/{docId} {
        allow read, write: if isOwner();
      }
      match /saves/{slotId} {
        allow read, write: if isOwner() && validSlot(slotId);
        match /data/{chunkId} {
          allow read, write: if isOwner() && validSlot(slotId);
        }
      }
      match /saveMeta/{slotId} {
        allow read, write: if isOwner() && validSlot(slotId);
      }
    }
  }
}
```

**Importante:** publique essas regras no Console (Firestore → Rules → Publish). Sem isso o save em partes (`saves/{slot}/data/*`) falha com permission-denied e outros aparelhos ficam desatualizados.
## 3. Domínios autorizados
Authentication → Settings → Authorized domains  
Adicione `localhost` (dev) e o domínio de produção (ex.: GitHub Pages).

## 4. Variáveis de ambiente
Copie `.env.example` → `.env` e preencha:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Reinicie o `npm run dev` após salvar o `.env`.

## 5. GitHub Pages (produção)

O `.env` **não** vai pro build do Pages. Cadastre as mesmas chaves como **Secrets** do repositório:

**Settings → Secrets and variables → Actions** → New repository secret:

| Secret | Valor |
|--------|--------|
| `VITE_FIREBASE_API_KEY` | do `.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | do `.env` |
| `VITE_FIREBASE_PROJECT_ID` | do `.env` |
| `VITE_FIREBASE_STORAGE_BUCKET` | do `.env` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | do `.env` |
| `VITE_FIREBASE_APP_ID` | do `.env` |

O workflow `deploy.yml` injeta essas variáveis no `npm run build`.

### Domínios autorizados no Firebase
Authentication → Settings → Authorized domains → adicione:
- `localhost`
- `pedrohfalcaro.github.io`

## Comportamento
- Login Google obrigatório no menu
- Save local imediato; nuvem em partes (`users/{uid}/saves/{slot}` + `data/players-*|matches-*|extras`) para não estourar o limite de 1 MiB
- Mescla por progresso (jogos/temporada), não só por data — evita celular antigo sobrescrever o PC
- No login, se o local tiver mais progresso, sobe automaticamente
- Se a sync falhar, aparece aviso no menu e no layout da carreira
